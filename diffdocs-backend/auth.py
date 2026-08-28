# auth.py
"""
Real "Sign in with GitHub" login.

Deliberately a separate, minimal GitHub OAuth App (not the GitHub App used for
webhooks in github_app.py) — this one only ever proves who the human is and
reads their own public-ish profile fields (`read:user user:email` scope, no
repo access requested). Repo data continues to flow through the GitHub App's
installation token, which isn't tied to any one user.

Note on scope of "profile data": GitHub has no concept of date of birth,
gender, or age — there is no API for them because GitHub doesn't collect
them. What IS available (and fetched below) is whatever the signed-in user
has chosen to put on their own GitHub profile: bio, company, location,
website, verified email, and any social accounts (LinkedIn, X, Facebook,
etc.) they've linked in their GitHub profile settings.

Flow:
  1. Frontend sends the browser to GET /auth/github/login.
  2. We redirect to GitHub's OAuth authorize screen.
  3. GitHub redirects back to GET /auth/github/callback with a `code`.
  4. We exchange the code for a user access token, fetch the profile, and
     mint our own short-lived JWT ("session token") encoding just the
     public profile fields.
  5. We redirect to the frontend with that JWT in a query param; the
     frontend stores it (e.g. localStorage) and sends it back as
     `Authorization: Bearer <token>` on API calls.

This keeps auth stateless and avoids cross-domain cookie issues between the
Vercel frontend and Render backend (different top-level domains).
"""
import os
import time
import logging
from typing import Optional

import httpx
import jwt
from fastapi import Header, HTTPException, status

logger = logging.getLogger("DiffDocsAuth")

GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_USER_URL = "https://api.github.com/user"
GITHUB_API_EMAILS_URL = "https://api.github.com/user/emails"
GITHUB_API_SOCIAL_ACCOUNTS_URL = "https://api.github.com/user/social_accounts"

SESSION_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _session_secret() -> str:
    secret = os.getenv("SESSION_SECRET")
    if not secret:
        raise RuntimeError("SESSION_SECRET is not configured.")
    return secret


def create_oauth_state() -> str:
    """
    Short-lived, signed nonce passed through GitHub's `state` param and
    checked back on callback — rejects forged or stale OAuth callbacks
    without needing a server-side session store.
    """
    now = int(time.time())
    return jwt.encode({"purpose": "oauth_state", "iat": now, "exp": now + 600}, _session_secret(), algorithm="HS256")


def verify_oauth_state(state: str) -> bool:
    try:
        payload = jwt.decode(state, _session_secret(), algorithms=["HS256"])
        return payload.get("purpose") == "oauth_state"
    except jwt.PyJWTError:
        return False


def build_authorize_url(redirect_uri: str, state: str) -> str:
    client_id = os.getenv("GITHUB_OAUTH_CLIENT_ID")
    if not client_id:
        raise RuntimeError("GITHUB_OAUTH_CLIENT_ID is not configured.")
    return (
        f"{GITHUB_OAUTH_AUTHORIZE_URL}"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=read:user user:email"
        f"&state={state}"
        f"&allow_signup=true"
    )


async def exchange_code_for_profile(code: str, redirect_uri: str) -> dict:
    """
    Trades the OAuth `code` for a user token, then fetches the profile —
    including the fields that need extra endpoints/scope: verified email and
    any social accounts the user has linked on their own GitHub profile.
    """
    client_id = os.getenv("GITHUB_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GITHUB_OAUTH_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("GitHub OAuth app is not configured (client id/secret missing).")

    async with httpx.AsyncClient(timeout=15) as client:
        token_response = await client.post(
            GITHUB_OAUTH_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        token_response.raise_for_status()
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not access_token:
            raise RuntimeError(f"GitHub did not return an access token: {token_payload}")

        auth_headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}

        user_response = await client.get(GITHUB_API_USER_URL, headers=auth_headers)
        user_response.raise_for_status()
        profile = user_response.json()

        # Best-effort extras: these can legitimately fail (e.g. the user has no
        # public/verified email, or hasn't linked any social accounts) — don't
        # let that break sign-in.
        email = profile.get("email")
        try:
            emails_response = await client.get(GITHUB_API_EMAILS_URL, headers=auth_headers)
            emails_response.raise_for_status()
            emails = emails_response.json()
            primary = next((e for e in emails if e.get("primary")), None)
            email = (primary or (emails[0] if emails else {})).get("email", email)
        except Exception:
            logger.warning("Could not fetch verified email for %s", profile.get("login"))

        social_accounts = []
        try:
            social_response = await client.get(GITHUB_API_SOCIAL_ACCOUNTS_URL, headers=auth_headers)
            social_response.raise_for_status()
            # Cap it — GitHub allows up to 10, and this rides in a URL-embedded JWT.
            social_accounts = [
                {"provider": acc.get("provider"), "url": acc.get("url")}
                for acc in social_response.json()[:10]
            ]
        except Exception:
            logger.warning("Could not fetch social accounts for %s", profile.get("login"))

    return {
        "id": profile["id"],
        "login": profile["login"],
        "name": profile.get("name") or profile["login"],
        "avatar_url": profile.get("avatar_url"),
        "email": email,
        "bio": (profile.get("bio") or "")[:300] or None,
        "company": profile.get("company"),
        "location": profile.get("location"),
        "blog": profile.get("blog") or None,
        "followers": profile.get("followers"),
        "public_repos": profile.get("public_repos"),
        "github_created_at": profile.get("created_at"),
        "social_accounts": social_accounts,
    }


def issue_session_token(profile: dict) -> str:
    now = int(time.time())
    payload = {
        "sub": str(profile["id"]),
        "login": profile["login"],
        "name": profile["name"],
        "avatar_url": profile["avatar_url"],
        "email": profile.get("email"),
        "bio": profile.get("bio"),
        "company": profile.get("company"),
        "location": profile.get("location"),
        "blog": profile.get("blog"),
        "followers": profile.get("followers"),
        "public_repos": profile.get("public_repos"),
        "github_created_at": profile.get("github_created_at"),
        "social_accounts": profile.get("social_accounts", []),
        "iat": now,
        "exp": now + SESSION_TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, _session_secret(), algorithm="HS256")


def verify_session_token(token: str) -> dict:
    try:
        return jwt.decode(token, _session_secret(), algorithms=["HS256"])
    except jwt.PyJWTError as err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.") from err


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency: requires a valid `Authorization: Bearer <token>` header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer session token.")
    token = authorization.removeprefix("Bearer ").strip()
    return verify_session_token(token)
