from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.db.session import get_db
from backend.app.services.rag_engine import HybridRAGEngine
from backend.app.scripts.seed_data import seed_transcripts

router = APIRouter(prefix="/transcripts", tags=["transcripts"])
rag_engine = HybridRAGEngine(top_k=10)

@router.get("/search")
async def search_transcripts(q: str = Query(..., min_length=2), db: AsyncSession = Depends(get_db)):
    results = await rag_engine.retrieve(db, query=q, top_k=10)
    return [
        {
            "episode_title": res.chunk.episode_title,
            "guest_name": res.chunk.guest_name,
            "episode_url": res.chunk.episode_url,
            "publish_date": res.chunk.publish_date,
            "content": res.chunk.content,
            "score": res.score
        } for res in results
    ]

@router.post("/seed")
async def trigger_seed():
    await seed_transcripts()
    return {"message": "Transcripts seeded successfully"}
