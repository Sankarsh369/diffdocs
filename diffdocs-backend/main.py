# main.py
import os
import sys
import hmac
import json
import hashlib
from contextlib import asynccontextmanager
from typing import Optional
from dotenv import load_dotenv

# Windows' default console codepage (cp1252) can't encode the emoji used in
# this file's log lines, which otherwise crashes on the very first print at
# import time. Force UTF-8 stdout/stderr wherever the runtime allows it.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

# FastAPI framework & validation imports
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

# ==========================================================
# 🛠️ CRITICAL PATH: ABSOLUTE ENVIRONMENT VARIABLE LOADING
# ==========================================================
# Force main.py to read the explicit file inside the backend directory scope
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

# Diagnostic verify print to confirm server context visibility at boot time
print(f"🔒 Security Status: Key Loaded (Length: {len(os.getenv('WEBHOOK_SECRET', ''))} chars)")

# ==========================================================
# 📦 INTERNAL SYSTEM MODULE DEPENDENCIES
# ==========================================================
from database import MongoDatabaseManager
from engine import DiffDocsEngine
from github_app import (
    fetch_commit_author,
    fetch_commit_diff,
    fetch_compare_diff,
    fetch_pull_request_diff,
    fetch_pull_request_reviews,
    get_installation_token,
)
import auth as auth_module

# ==========================================
# ⚡ GLOBAL SINGLETON INSTANCES & LIFESPAN
# ==========================================
# Connection pooling optimization: Instantiated once globally to prevent exhaustion
db_manager = MongoDatabaseManager()
engine = DiffDocsEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Executes mission-critical startup operations before server accepts traffic."""
    print("🚀 Booting DiffDocs Backend Services...")
    try:
        # Build or verify indexes on Atlas right at boot time
        await db_manager.setup_indexes()
    except Exception as e:
        print(f"🚨 Critical Failure during infrastructure boot setup: {str(e)}")
    yield
    print("🔌 Shutting down DiffDocs Backend Services cleanly...")

# Initialize FastAPI app with modern lifespan handling
app = FastAPI(
    title="DiffDocs Core API Engine", 
    version="1.0.0", 
    lifespan=lifespan
)

# CORS configuration: restrict to known frontend origin(s) in production via CORS_ORIGINS env var
# (comma-separated). Falls back to "*" for local development only.
_cors_origins_env = os.getenv("CORS_ORIGINS", "*")
_allowed_origins = ["*"] if _cors_origins_env.strip() == "*" else [
    origin.strip() for origin in _cors_origins_env.split(",") if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 📋 INCOMING PAYLOAD VALIDATION SCHEMA
# ==========================================
class GitHubWebhookPayload(BaseModel):
    repo_identifier: str = Field(
        ..., 
        json_schema_extra={"example": "username/repository-name"}
    )
    commit_sha: str = Field(
        ..., 
        json_schema_extra={"example": "a1b2c3d4e5f6g7h8i9j0"}
    )
    diff_content: str = Field(
        ..., 
        json_schema_extra={"example": "--- a/file.js\n+++ b/file.js..."}
    )

# ==========================================
# 🔄 CORE PIPELINE ORCHESTRATION
# ==========================================
async def orchestrate_webhook_pipeline(
    repo: str,
    sha: str,
    diff_content: str,
    author: Optional[dict] = None,
    pr_number: Optional[int] = None,
):
    """Coordinates high-performance caching layer checks and AI analysis processing."""

    # Step 1: Hit Cache Layer (Reusing global singleton pool)
    cached_data = await db_manager.get_cached_summary(sha)
    if cached_data:
        print(f"⚡ Cache Hit! Returning pre-computed telemetry for SHA: {sha}")
        return cached_data["analysis"]

    # Step 2: Invoke the Gemini Async Engine if cache misses
    print(f"🧠 Cache Miss. Compiling context and routing to Gemini Engine...")
    structured_ai_output = await engine.generate_summary(diff_content)

    # Step 3: Persist analytical output straight to Atlas to freeze future overhead
    await db_manager.save_summary(repo, sha, structured_ai_output, author=author, pr_number=pr_number)

    return structured_ai_output.model_dump()

# ==========================================
# ❤️ HEALTH CHECK (used by hosting platforms / uptime monitors)
# ==========================================
@app.get("/", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok", "service": "DiffDocs Core API Engine"}

# ==========================================
# 📡 PRODUCTION WEBHOOK API ENDPOINT
# ==========================================
@app.post("/webhook/github", status_code=status.HTTP_200_OK)
async def handle_github_webhook(
    request: Request, 
    x_diffdocs_signature: str = Header(None)
):
    """
    Secured enterprise entrypoint capturing signed GitHub repository updates.
    """
    secret = os.getenv("WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(
            status_code=500, 
            detail="Server misconfiguration: Cryptographic verification token missing."
        )

    # 1. Capture the incoming raw bytes
    raw_payload = await request.body()

    # 2. Compute the raw byte signature
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        raw_payload,
        hashlib.sha256
    ).hexdigest()

    # 🔥 DIAGNOSTIC RADAR: Print both signatures to see the exact structural variance
    print(f"📥 Incoming GitHub Signature: {x_diffdocs_signature}")
    print(f"🔮 Expected Local Signature: {expected_signature}")

    # 3. Security Check: Fallback to structural verification if raw bytes are altered by the network
    if not x_diffdocs_signature or not hmac.compare_digest(x_diffdocs_signature, expected_signature):
        try:
            # If raw bytes don't match, parse content structure directly to bypass network formatting alterations
            parsed_json = await request.json()
            fallback_bytes = json.dumps(parsed_json, sort_keys=True, separators=(',', ':')).encode("utf-8")
            structural_signature = hmac.new(secret.encode("utf-8"), fallback_bytes, hashlib.sha256).hexdigest()
            
            if hmac.compare_digest(x_diffdocs_signature, structural_signature):
                print("🛡️  Security Shield: Structural match verified successfully (Network formatting bypassed).")
            else:
                raise ValueError()
        except Exception:
            print("🚨 SECURITY SHIELD: Unauthorized payload dropped! Signatures mismatched.")
            raise HTTPException(
                status_code=403, 
                detail="Invalid cryptographic signature. Access Denied."
            )

    # 4. Process Verified Payload
    try:
        payload_data = await request.json()
        print(f"🔒 Security Verified. Routing payload to orchestrator for: {payload_data.get('repo_identifier')}")
        result_data = await orchestrate_webhook_pipeline(
            repo=payload_data.get("repo_identifier"),
            sha=payload_data.get("commit_sha"),
            diff_content=payload_data.get("diff_content")
        )
        return {"status": "success", "data": result_data}

    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as err:
        print(f"🚨 Internal pipeline extraction failure: {str(err)}")
        raise HTTPException(status_code=500, detail="Internal core validation pipeline error occurred.")

# ==========================================
# 🐙 REAL GITHUB APP WEBHOOK ENDPOINT
# ==========================================
def _verify_github_app_signature(raw_payload: bytes, signature_header: Optional[str]) -> bool:
    """
    Verifies GitHub's own webhook signature scheme: header `X-Hub-Signature-256:
    sha256=<hex-hmac>`, computed over the raw request body with the App's
    webhook secret (set on the App itself, distinct from WEBHOOK_SECRET which
    guards the manual /webhook/github endpoint above).
    """
    secret = os.getenv("GITHUB_APP_WEBHOOK_SECRET")
    if not secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


async def _process_github_app_event(event_type: str, payload: dict):
    """
    Background task: resolves the real unified diff for a push or pull request
    via the GitHub API (using a short-lived installation token) and routes it
    through the same cache-then-Gemini pipeline as the manual endpoint.
    """
    try:
        installation_id = payload.get("installation", {}).get("id")
        if not installation_id:
            print("🚨 GitHub App event missing installation id — skipping.")
            return

        if event_type == "push":
            # Ignore branch/tag deletions and no-op pushes (e.g. an empty force-push).
            if payload.get("deleted") or not payload.get("commits"):
                return

            repo_full_name = payload["repository"]["full_name"]
            owner, repo = repo_full_name.split("/", 1)
            head_sha = payload["after"]
            base_sha = payload.get("before")

            token = await get_installation_token(installation_id)
            # `before` is all zeros on a brand-new branch — nothing to compare against.
            if base_sha and set(base_sha) != {"0"}:
                diff_content = await fetch_compare_diff(owner, repo, base_sha, head_sha, token)
            else:
                diff_content = await fetch_commit_diff(owner, repo, head_sha, token)

            # Real GitHub identity behind this commit (not just the payload's
            # `pusher` field, which is just a git name/email, not an account).
            author = await fetch_commit_author(owner, repo, head_sha, token)

            print(f"🐙 GitHub App push event → analyzing {repo_full_name}@{head_sha[:7]} (author: {author['login']})")
            await orchestrate_webhook_pipeline(repo=repo_full_name, sha=head_sha, diff_content=diff_content, author=author)

        elif event_type == "pull_request" and payload.get("action") in ("opened", "synchronize", "reopened"):
            repo_full_name = payload["repository"]["full_name"]
            owner, repo = repo_full_name.split("/", 1)
            pull_request = payload["pull_request"]
            head_sha = pull_request["head"]["sha"]

            token = await get_installation_token(installation_id)
            diff_content = await fetch_pull_request_diff(owner, repo, pull_request["number"], token)

            # The PR payload already carries the real author account — no extra API call needed.
            author = {"login": pull_request["user"]["login"], "avatar_url": pull_request["user"].get("avatar_url")}

            print(f"🐙 GitHub App PR event → analyzing {repo_full_name}#{pull_request['number']} (author: {author['login']})")
            await orchestrate_webhook_pipeline(
                repo=repo_full_name, sha=head_sha, diff_content=diff_content,
                author=author, pr_number=pull_request["number"],
            )

        elif event_type == "pull_request" and payload.get("action") == "closed" and payload.get("pull_request", {}).get("merged"):
            # A PR only has its final reviewer roster once it's actually merged —
            # reviews can keep arriving after we analyzed the diff on `synchronize`.
            repo_full_name = payload["repository"]["full_name"]
            owner, repo = repo_full_name.split("/", 1)
            pull_request = payload["pull_request"]
            head_sha = pull_request["head"]["sha"]

            token = await get_installation_token(installation_id)
            reviews = await fetch_pull_request_reviews(owner, repo, pull_request["number"], token)

            # Keep only each reviewer's most recent review state (GitHub returns them chronologically).
            latest_by_login = {review["login"]: review for review in reviews}
            reviewers = list(latest_by_login.values())

            print(f"🐙 GitHub App PR merged → attaching {len(reviewers)} real reviewer(s) to {repo_full_name}#{pull_request['number']}")
            await db_manager.attach_reviewers(commit_sha=head_sha, reviewers=reviewers)

    except Exception as err:
        print(f"🚨 GitHub App event processing failure ({event_type}): {str(err)}")


@app.post("/webhook/github-app", status_code=status.HTTP_202_ACCEPTED)
async def handle_github_app_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(None),
    x_github_event: str = Header(None),
):
    """
    Real GitHub App webhook receiver — this is the URL you register on the App
    itself. Unlike /webhook/github, GitHub does not send the diff content: this
    handler fetches it from the GitHub API using an installation token, then
    hands it to the same analysis pipeline.
    """
    raw_payload = await request.body()

    if not _verify_github_app_signature(raw_payload, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Invalid GitHub webhook signature.")

    if x_github_event == "ping":
        return {"status": "pong"}

    if x_github_event in ("push", "pull_request"):
        payload = await request.json()
        # Respond immediately — GitHub expects a fast ack, and diff-fetch +
        # Gemini analysis can take longer than its timeout allows.
        background_tasks.add_task(_process_github_app_event, x_github_event, payload)

    return {"status": "accepted"}

# ==========================================
# 🔑 SIGN IN WITH GITHUB
# ==========================================
def _backend_url() -> str:
    return os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


@app.get("/auth/github/login")
async def github_login():
    """Sends the browser to GitHub's OAuth consent screen."""
    redirect_uri = f"{_backend_url()}/auth/github/callback"
    state = auth_module.create_oauth_state()
    return RedirectResponse(auth_module.build_authorize_url(redirect_uri, state))


@app.get("/auth/github/callback")
async def github_callback(state: str, code: Optional[str] = None, error: Optional[str] = None):
    """GitHub redirects here after the user approves (or declines) the app."""
    if not auth_module.verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")

    if error or not code:
        # User clicked "Cancel" on GitHub's consent screen — send them back, no session issued.
        return RedirectResponse(f"{_frontend_url()}/?auth_error={error or 'no_code'}")

    try:
        redirect_uri = f"{_backend_url()}/auth/github/callback"
        profile = await auth_module.exchange_code_for_profile(code, redirect_uri)
        session_token = auth_module.issue_session_token(profile)
    except Exception as err:
        print(f"🚨 GitHub OAuth exchange failed: {str(err)}")
        raise HTTPException(status_code=502, detail="GitHub sign-in failed. Please try again.")

    return RedirectResponse(f"{_frontend_url()}/?session_token={session_token}")


@app.get("/api/me", status_code=status.HTTP_200_OK)
async def get_current_profile(current_user: dict = Depends(auth_module.get_current_user)):
    """Returns the signed-in user's real GitHub profile, decoded from their session token."""
    return {
        "login": current_user["login"],
        "name": current_user["name"],
        "avatar_url": current_user["avatar_url"],
    }


# ==========================================
# 📊 DASHBOARD DATA (requires sign-in)
# ==========================================
@app.get("/api/telemetry", status_code=status.HTTP_200_OK)
async def get_all_repository_telemetry(current_user: dict = Depends(auth_module.get_current_user)):
    """
    Dashboard extraction gateway fetching historical analysis telemetry for frontend visualization.
    """
    try:
        # Pull records out of MongoDB Atlas via your global singleton pool manager
        historical_records = await db_manager.get_all_summaries()
        return {
            "status": "success",
            "count": len(historical_records),
            "data": historical_records
        }
    except Exception as err:
        print(f"🚨 Dashboard data compilation failure: {str(err)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve synchronized telemetry logs."
        )


@app.get("/api/team", status_code=status.HTTP_200_OK)
async def get_team_workload(current_user: dict = Depends(auth_module.get_current_user)):
    """
    Real per-contributor authored/reviewed workload, derived from actual
    GitHub commit authors and PR reviewers — no fictional teammates.
    """
    try:
        workload = await db_manager.get_team_workload()
        return {"status": "success", "count": len(workload), "data": workload}
    except Exception as err:
        print(f"🚨 Team workload compilation failure: {str(err)}")
        raise HTTPException(status_code=500, detail="Failed to compute team workload.")


# ==========================================
# 🚀 LOCAL RUNTIME CONFIGURATION
# ==========================================
if __name__ == "__main__":
    import uvicorn
    # Render/Railway/etc inject PORT; default to 8000 for local dev.
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)