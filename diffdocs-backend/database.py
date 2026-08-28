# database.py
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Dict, Any, List

# Fetching the URI from your secure vault (.env)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# Risk weighting used to turn raw authored/reviewed counts into a single
# 0-100 "cognitive load" score for the team dashboard.
_RISK_WEIGHT = {"High": 25, "Medium": 12, "Low": 5}


class MongoDatabaseManager:
    def __init__(self):
        # Initialize the non-blocking async MongoDB client instance
        self.client = AsyncIOMotorClient(MONGO_URI)
        # Database and collection allocation (Implicit creation happens here)
        self.db = self.client["diffdocs_prod"]
        self.collection = self.db["pr_summaries"]

    async def setup_indexes(self):
        """Ensures rapid document lookup and strictly enforces data uniqueness."""
        # Uniqueness guard: A commit SHA can never be processed or stored twice
        await self.collection.create_index("commit_sha", unique=True)
        await self.collection.create_index("repo_identifier")
        print("✅ Database Optimization: Unique indexes verified on MongoDB Atlas.")

    async def get_cached_summary(self, commit_sha: str) -> Optional[Dict[str, Any]]:
        """Scans the collection for an existing commit analysis profile."""
        return await self.collection.find_one({"commit_sha": commit_sha})

    async def save_summary(
        self,
        repo_identifier: str,
        commit_sha: str,
        structured_output: Any,
        author: Optional[Dict[str, Any]] = None,
        pr_number: Optional[int] = None,
    ):
        """Dumps the validated Pydantic model directly into Atlas as a native JSON document."""
        document = {
            "repo_identifier": repo_identifier,
            "commit_sha": commit_sha,
            "analysis": structured_output.model_dump(),
            "author": author,       # real GitHub {login, avatar_url}, when known
            "pr_number": pr_number, # set when this commit came from a pull_request event
            "reviewers": [],        # filled in later via attach_reviewers() on PR merge
            "created_at": datetime.utcnow()
        }
        await self.collection.insert_one(document)
        print(f"💾 Document successfully cached in MongoDB Atlas for commit: {commit_sha}")

    async def attach_reviewers(self, commit_sha: str, reviewers: List[Dict[str, Any]]):
        """
        Attaches the real reviewer roster to an already-cached analysis —
        called once a pull request is merged, since reviews can keep coming
        in after the diff itself was analyzed on `synchronize`.
        """
        result = await self.collection.update_one(
            {"commit_sha": commit_sha},
            {"$set": {"reviewers": reviewers}},
        )
        if result.matched_count:
            print(f"👥 Attached {len(reviewers)} real reviewer(s) to commit: {commit_sha}")
        else:
            print(f"⚠️  No cached analysis found for commit {commit_sha} — reviewers not attached.")

    # 🔥 NEWLY ADDED: Fetches all analytics logs and converts ObjectIds to strings
    async def get_all_summaries(self) -> List[Dict[str, Any]]:
        """Retrieves all historical telemetry documents, sorted by newest first."""
        # Find all documents ({}) and sort by creation timestamp descending (-1)
        cursor = self.collection.find({}).sort("created_at", -1)
        records = await cursor.to_list(length=100) # Grabs the latest 100 entries

        # Safe JSON Conversion: Transform BSON ObjectId elements into standard strings
        for record in records:
            if "_id" in record:
                record["_id"] = str(record["_id"])

        return records

    async def get_commit_counts_by_repo(self) -> Dict[str, int]:
        """Number of cached analyses per repo_identifier, across the full collection (not just the latest 100)."""
        cursor = self.collection.aggregate([{"$group": {"_id": "$repo_identifier", "count": {"$sum": 1}}}])
        return {doc["_id"]: doc["count"] async for doc in cursor if doc["_id"]}

    async def get_team_workload(self, repo_identifier: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Aggregates real per-contributor workload from stored analyses: who
        authored what (and at what risk level), and who actually reviewed it
        on GitHub — no fictional teammates, no guessed assignments.

        Pass `repo_identifier` (e.g. "owner/repo") to scope this to one
        connected repo instead of blending every repo together.
        """
        query = {"repo_identifier": repo_identifier} if repo_identifier else {}
        cursor = self.collection.find(query, {"analysis.estimated_risk": 1, "author": 1, "reviewers": 1})
        records = await cursor.to_list(length=500)

        contributors: Dict[str, Dict[str, Any]] = {}

        def _bucket(login: str, avatar_url: Optional[str]) -> Dict[str, Any]:
            if login not in contributors:
                contributors[login] = {
                    "login": login,
                    "avatarUrl": avatar_url,
                    "authored": {"High": 0, "Medium": 0, "Low": 0},
                    "reviewed": {"High": 0, "Medium": 0, "Low": 0},
                }
            elif avatar_url and not contributors[login]["avatarUrl"]:
                contributors[login]["avatarUrl"] = avatar_url
            return contributors[login]

        for record in records:
            risk = (record.get("analysis") or {}).get("estimated_risk", "Low")
            if risk not in _RISK_WEIGHT:
                risk = "Low"

            author = record.get("author")
            if author and author.get("login"):
                _bucket(author["login"], author.get("avatar_url"))["authored"][risk] += 1

            seen_reviewers = set()
            for reviewer in record.get("reviewers") or []:
                login = reviewer.get("login")
                if not login or login in seen_reviewers:
                    continue  # a reviewer re-reviewing the same PR only counts once per PR
                seen_reviewers.add(login)
                _bucket(login, reviewer.get("avatar_url"))["reviewed"][risk] += 1

        workload = []
        for contributor in contributors.values():
            authored, reviewed = contributor["authored"], contributor["reviewed"]
            load_score = min(
                100,
                sum(_RISK_WEIGHT[risk] * (authored[risk] + reviewed[risk]) for risk in _RISK_WEIGHT),
            )
            workload.append({**contributor, "loadScore": load_score})

        workload.sort(key=lambda c: c["loadScore"], reverse=True)
        return workload
