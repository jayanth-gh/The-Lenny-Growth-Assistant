import logging
import math
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.db.models import TranscriptChunk
from rank_bm25 import BM25Okapi
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

logger = logging.getLogger("lenny_assistant.rag")

class RetrievalResult:
    def __init__(self, chunk: TranscriptChunk, score: float):
        self.chunk = chunk
        self.score = score

    def to_citation_dict(self) -> Dict[str, Any]:
        return {
            "episode_title": self.chunk.episode_title,
            "guest_name": self.chunk.guest_name,
            "episode_url": self.chunk.episode_url,
            "publish_date": self.chunk.publish_date,
            "excerpt": self.chunk.content[:280] + "..." if len(self.chunk.content) > 280 else self.chunk.content
        }

class HybridRAGEngine:
    def __init__(self, top_k: int = 5):
        self.top_k = top_k

    async def retrieve(self, db: AsyncSession, query: str, top_k: Optional[int] = None) -> List[RetrievalResult]:
        k = top_k or self.top_k
        stmt = select(TranscriptChunk)
        result = await db.execute(stmt)
        chunks = result.scalars().all()

        if not chunks:
            logger.warning("No transcript chunks found in database.")
            return []

        corpus_texts = [c.content for c in chunks]
        
        # 1. Lexical BM25 Scoring
        tokenized_corpus = [doc.lower().split() for doc in corpus_texts]
        bm25 = BM25Okapi(tokenized_corpus)
        query_tokens = query.lower().split()
        bm25_scores = bm25.get_scores(query_tokens)

        # 2. Semantic TF-IDF Cosine Similarity Scoring
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(corpus_texts)
        query_vec = vectorizer.transform([query])
        cosine_sims = cosine_similarity(query_vec, tfidf_matrix).flatten()

        # 3. Hybrid Reciprocal Rank Fusion (RRF)
        bm25_ranks = np.argsort(bm25_scores)[::-1]
        cosine_ranks = np.argsort(cosine_sims)[::-1]

        rrf_scores = np.zeros(len(chunks))
        rrf_k = 60
        for rank, idx in enumerate(bm25_ranks):
            rrf_scores[idx] += 1.0 / (rrf_k + rank + 1)
        for rank, idx in enumerate(cosine_ranks):
            rrf_scores[idx] += 1.0 / (rrf_k + rank + 1)

        sorted_indices = np.argsort(rrf_scores)[::-1]
        best_bm25 = float(np.max(bm25_scores)) if len(bm25_scores) else 0.0
        best_cosine = float(np.max(cosine_sims)) if len(cosine_sims) else 0.0

        # RRF always assigns a small positive score, even to unrelated documents.
        # Require lexical or semantic evidence before returning context to the LLM.
        if best_bm25 <= 0 and best_cosine < 0.08:
            return []
        
        results = []
        for idx in sorted_indices[:k]:
            score = float(rrf_scores[idx])
            # Only include if score shows meaningful relevance
            has_lexical_match = bm25_scores[idx] > 0
            has_semantic_match = cosine_sims[idx] >= max(0.08, best_cosine * 0.35)
            if score > 0.01 and (has_lexical_match or has_semantic_match):
                results.append(RetrievalResult(chunk=chunks[idx], score=score))

        return results

    def format_context_for_prompt(self, retrieval_results: List[RetrievalResult]) -> str:
        if not retrieval_results:
            return "NO RELEVANT TRANSCRIPT CONTEXT FOUND."

        formatted_blocks = []
        for i, res in enumerate(retrieval_results, 1):
            c = res.chunk
            block = (
                f"--- SOURCE ITEM [{i}] ---\n"
                f"Episode: {c.episode_title}\n"
                f"Guest: {c.guest_name}\n"
                f"URL: {c.episode_url}\n"
                f"Content: {c.content[:1800]}\n"
                f"-------------------------"
            )
            formatted_blocks.append(block)

        return "\n\n".join(formatted_blocks)
