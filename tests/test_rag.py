import pytest
from backend.app.services.rag_engine import HybridRAGEngine
from backend.app.db.session import AsyncSessionLocal, init_db
from backend.app.scripts.seed_data import seed_transcripts

@pytest.mark.asyncio
async def test_hybrid_rag_retrieval():
    await init_db()
    await seed_transcripts()
    
    rag = HybridRAGEngine(top_k=3)
    async with AsyncSessionLocal() as session:
        results = await rag.retrieve(session, query="Elena Verna Product Led Growth PLG loops")
        assert len(results) > 0
        top_res = results[0]
        assert top_res.chunk.guest_name == "Elena Verna"
        citation = top_res.to_citation_dict()
        assert "episode_title" in citation
        assert "guest_name" in citation

@pytest.mark.asyncio
async def test_unrelated_query_retrieval_fallback():
    await init_db()
    rag = HybridRAGEngine(top_k=3)
    async with AsyncSessionLocal() as session:
        results = await rag.retrieve(session, query="quantum physics black holes general relativity")
        assert results == []
        formatted = rag.format_context_for_prompt(results)
        assert formatted == "NO RELEVANT TRANSCRIPT CONTEXT FOUND."
