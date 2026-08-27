# database.py
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Dict, Any, List

# Fetching the URI from your secure vault (.env)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

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

    async def save_summary(self, repo_identifier: str, commit_sha: str, structured_output: Any):
        """Dumps the validated Pydantic model directly into Atlas as a native JSON document."""
        document = {
            "repo_identifier": repo_identifier,
            "commit_sha": commit_sha,
            "analysis": structured_output.model_dump(),
            "created_at": datetime.utcnow()
        }
        await self.collection.insert_one(document)
        print(f"💾 Document successfully cached in MongoDB Atlas for commit: {commit_sha}")

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