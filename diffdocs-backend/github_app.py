# github_app.py
"""
Thin async client for authenticating as a GitHub App and pulling real diffs
from the GitHub API. Used by the /webhook/github-app endpoint in main.py.

Auth flow (see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app):
  1. Sign a short-lived JWT with the App's private key, identifying the App itself.
  2. Exchange that JWT for a short-lived installation access token, scoped to
     whichever repos the App was installed on.
  3. Use the installation token as a normal Bearer token against the REST API.
"""
import os
import time
import logging

import httpx
import jwt

logger = logging.getLogger("GitHubAppClient")

GITHUB_API_BASE = "https://api.github.com"
DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff"


def _get_app_id() -> str:
    app_id = os.getenv("GITHUB_APP_ID")
    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is not configured.")
    return app_id


def _load_private_key() -> str:
    """
    Reads the App's PEM private key from GITHUB_APP_PRIVATE_KEY. Supports both
    a real multi-line value (most hosting dashboards accept pasting the full
    .pem contents into a textarea) and a single-line value with literal `\\n`
    escapes (useful for platforms that don't).
    """
    private_key = os.getenv("GITHUB_APP_PRIVATE_KEY")
    if not private_key:
        raise RuntimeError("GITHUB_APP_PRIVATE_KEY is not configured.")
    return private_key.replace("\\n", "\n")


def _generate_app_jwt() -> str:
    """Builds the App-level JWT used only to mint installation tokens."""
    now = int(time.time())
    payload = {
        "iat": now - 60,        # back-dated slightly to tolerate clock drift
        "exp": now + (9 * 60),  # GitHub caps this at 10 minutes
        "iss": _get_app_id(),
    }
    return jwt.encode(payload, _load_private_key(), algorithm="RS256")


async def list_installations() -> list[dict]:
    """
    Every account/org the App is installed on, e.g.
    [{"id": 12345, "account_login": "octocat", "account_avatar_url": "..."}].
    Used to discover *all* connected repos, not just ones a webhook has fired for.
    """
    app_jwt = _generate_app_jwt()
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/app/installations",
            headers={"Authorization": f"Bearer {app_jwt}", "Accept": "application/vnd.github+json"},
        )
        response.raise_for_status()
        installations = response.json()

    return [
        {
            "id": inst["id"],
            "account_login": inst.get("account", {}).get("login"),
            "account_avatar_url": inst.get("account", {}).get("avatar_url"),
        }
        for inst in installations
    ]


async def list_installation_repositories(installation_id: int, token: str) -> list[dict]:
    """All repos a single installation grants access to (paginated, capped at 100)."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/installation/repositories",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            params={"per_page": 100},
        )
        response.raise_for_status()
        data = response.json()

    return [
        {
            "full_name": repo["full_name"],
            "name": repo["name"],
            "owner": repo["owner"]["login"],
            "private": repo["private"],
            "html_url": repo["html_url"],
            "default_branch": repo.get("default_branch"),
        }
        for repo in data.get("repositories", [])
    ]


async def list_pull_requests(owner: str, repo: str, token: str, per_page: int = 15) -> list[dict]:
    """
    Most recently updated pull requests for a repo (any state), newest first —
    used to backfill analysis for PRs that existed before the App was installed.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            params={"state": "all", "sort": "updated", "direction": "desc", "per_page": per_page},
        )
        response.raise_for_status()
        pulls = response.json()

    return [
        {
            "number": pr["number"],
            "title": pr["title"],
            "head_sha": pr["head"]["sha"],
            "merged": pr.get("merged_at") is not None,
            "state": pr["state"],
            "user_login": pr["user"]["login"],
            "user_avatar_url": pr["user"].get("avatar_url"),
        }
        for pr in pulls
    ]


async def get_installation_token(installation_id: int) -> str:
    """Exchanges the App JWT for a token scoped to one installation (i.e. one account/org)."""
    app_jwt = _generate_app_jwt()
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{GITHUB_API_BASE}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
            },
        )
        response.raise_for_status()
        return response.json()["token"]


async def fetch_commit_diff(owner: str, repo: str, sha: str, token: str) -> str:
    """Unified diff introduced by a single commit (used for the first push to a branch)."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{sha}",
            headers={"Authorization": f"Bearer {token}", "Accept": DIFF_MEDIA_TYPE},
        )
        response.raise_for_status()
        return response.text


async def fetch_compare_diff(owner: str, repo: str, base: str, head: str, token: str) -> str:
    """Unified diff between two commits (used for ordinary pushes with a known prior SHA)."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/compare/{base}...{head}",
            headers={"Authorization": f"Bearer {token}", "Accept": DIFF_MEDIA_TYPE},
        )
        response.raise_for_status()
        return response.text


async def fetch_pull_request_diff(owner: str, repo: str, pr_number: int, token: str) -> str:
    """Unified diff for an entire pull request."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}",
            headers={"Authorization": f"Bearer {token}", "Accept": DIFF_MEDIA_TYPE},
        )
        response.raise_for_status()
        return response.text


async def fetch_commit_author(owner: str, repo: str, sha: str, token: str) -> dict:
    """
    Real GitHub identity behind a commit (for a push event, which — unlike a
    pull_request payload — doesn't include the pusher's account in a
    trustworthy way). Falls back to the raw git commit signature if the
    author isn't a linked GitHub account.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{sha}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        response.raise_for_status()
        data = response.json()

    github_author = data.get("author")
    if github_author and github_author.get("login"):
        return {"login": github_author["login"], "avatar_url": github_author.get("avatar_url")}

    git_author_name = data.get("commit", {}).get("author", {}).get("name", "unknown")
    return {"login": git_author_name, "avatar_url": None}


async def fetch_pull_request_reviews(owner: str, repo: str, pr_number: int, token: str) -> list[dict]:
    """
    Real reviewers for a pull request, e.g. [{"login": "octocat", "avatar_url":
    "...", "state": "APPROVED"}, ...]. One reviewer can appear more than once
    (re-reviews); callers that want a unique roster should dedupe by login.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}/reviews",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        response.raise_for_status()
        reviews = response.json()

    return [
        {
            "login": review["user"]["login"],
            "avatar_url": review["user"].get("avatar_url"),
            "state": review["state"],
        }
        for review in reviews
        if review.get("user")
    ]
