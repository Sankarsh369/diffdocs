# engine.py
import os
import logging
from typing import List, Literal
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Enterprise logging setup
logger = logging.getLogger("DiffDocsEngine")
load_dotenv()

# ==========================================
# 1. STRONGLY TYPED DATA SCHEMAS (Pydantic)
# ==========================================
# Ye schemas Gemini ko force karte hain ek fixed JSON structure return karne ke liye.

class ComponentChange(BaseModel):
    file_path: str = Field(description="The path to the source file being modified.")
    action: Literal["added", "modified", "deleted"] = Field(description="The type of git file operation.")
    summary: str = Field(description="Highly concise statement of WHAT structural code element changed.")
    justification: str = Field(description="The engineering rationale or WHY this alteration was introduced.")
    operational_impact: str = Field(description="The practical runtime or architectural consequence of this specific block.")

class ArchitectureSummary(BaseModel):
    title: str = Field(description="A brief, professional PR or commit scope title.")
    estimated_risk: Literal["Low", "Medium", "High"] = Field(description="Risk evaluation based on mutation complexity, breaking states, or file scopes.")
    features: List[ComponentChange] = Field(default=[], description="User-facing features or substantive updates introduced.")
    bug_fixes: List[ComponentChange] = Field(default=[], description="Resolved runtime exceptions, edge cases, or broken states.")
    refactoring: List[ComponentChange] = Field(default=[], description="Structural or optimization changes devoid of visible behavior modification.")
    breaking_changes: List[str] = Field(default=[], description="Explicitly document any backward-incompatible API changes or destructive schemas.")

# ==========================================
# 2. THE CORE ASYNC AI ENGINE
# ==========================================

class DiffDocsEngine:
    """
    High-performance async engine for code diff comprehension 
    and structured documentation generation.
    """
    def __init__(self, model_name: str = "gemini-3.1-flash-lite"):
        # Google GenAI Client initialization (Main.py me global hone ki wajah se ye sirf EK baar chalega)
        self.client = genai.Client()
        self.model_name = model_name
        
    def _build_system_instruction(self, audience: str) -> str:
        """Dynamically creates target prompt parameters based on audience type."""
        base_instruction = (
            "You are a deeply experienced Principal Software Engineer and System Architect.\n"
            "Your operational mandate is to scan a raw `git diff` payload and extract clean architectural truths.\n"
            "Do not hallucinate intent. Be objective, hyper-concise, and structurally precise."
        )
        if audience == "executive":
            return f"{base_instruction}\nFocus purely on business logic metrics, client-facing alterations, high-level impact vectors, and risk classification indices."
        return f"{base_instruction}\nFocus purely on low-level design patterns, exception mitigation branches, dependencies, and execution efficiency changes."

    async def generate_summary(self, git_diff_content: str, audience: Literal["technical", "executive"] = "technical") -> ArchitectureSummary:
        """
        Ingests a raw code diff stream, checks token limits asynchronously, 
        and extracts a perfectly structured Pydantic schema object.
        """
        if not git_diff_content or not git_diff_content.strip():
            raise ValueError("Input git diff content stream cannot be null or empty.")

        # 🔥 THE FIX: Awaiting the token check via the async client (.aio)
        # Isse bade code diffs check karte waqt tumhara core event loop freeze nahi hoga.
        token_assessment = await self.client.aio.models.count_tokens(
            model=self.model_name,
            contents=git_diff_content
        )
        logger.info(f"Incoming diff weight: {token_assessment.total_tokens} tokens.")
        
        # Safe Guardrail limit check
        if token_assessment.total_tokens > 250000:
            logger.warning("Large payload detected. Truncation or optimization recommended.")

        system_prompt = self._build_system_instruction(audience)

        try:
            # Calling Gemini asynchronously to keep the server ultra responsive
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=f"Process this raw repository stream input:\n\n{git_diff_content}",
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.1,  # Grounded, deterministic tracking
                    response_mime_type="application/json",
                    response_schema=ArchitectureSummary, # Strict schema constraint enforced directly by the LLM
                )
            )
            
            # The official SDK directly populates your Pydantic data model via .parsed
            return response.parsed
            
        except Exception as e:
            logger.error(f"Upstream Engine Processing Failure: {str(e)}")
            raise RuntimeError("Failed to build structural documentation artifact via internal engine.") from e