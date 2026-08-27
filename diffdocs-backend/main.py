# main.py
import os
import hmac
import json
import hashlib
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# FastAPI framework & validation imports
from fastapi import FastAPI, HTTPException, Request, Header, status
from fastapi.middleware.cors import CORSMiddleware
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
async def orchestrate_webhook_pipeline(repo: str, sha: str, diff_content: str):
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
    await db_manager.save_summary(repo, sha, structured_ai_output)
    
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

# Place this inside your existing main.py file right above the uvicorn execution block

@app.get("/api/telemetry", status_code=status.HTTP_200_OK)
async def get_all_repository_telemetry():
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
     
# ==========================================
# 🚀 LOCAL RUNTIME CONFIGURATION
# ==========================================
if __name__ == "__main__":
    import uvicorn
    # Render/Railway/etc inject PORT; default to 8000 for local dev.
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)