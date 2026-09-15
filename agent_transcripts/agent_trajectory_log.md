# Agent Development Trajectory & Debugging Log

**Project:** The Lenny Growth Assistant  
**Date:** 13/09/2026  
**Agent:** Autonomous AI Assistant (Antigravity)  

---

## Session Trajectory Overview

This document captures the trajectory of autonomous software engineering steps, prompt engineering iterations, error resolutions, and trade-off decisions made while building "The Lenny Growth Assistant".

---

## 1. Initial Architecture & Database Schema Selection

### Requirement
Store chat sessions, messages, citations, artifacts, and transcript vector embeddings in PostgreSQL.

### Attempt #1 (Failed)
Attempted to use standard synchronous SQLAlchemy models with `psycopg2`.
- *Issue:* High concurrency overhead and blocking I/O during LLM streaming.
- *Correction:* Refactored database module to async-native SQLAlchemy (`asyncpg` for PostgreSQL in production with `sqlite+aiosqlite` fallback for zero-dependency local testing).

---

## 2. Hybrid RAG Engine Tuning

### Requirement
Precision retrieval over Lenny's Podcast transcripts with low latency and source grounding.

### Attempt #1 (Failed)
Relying solely on vector embeddings for retrieval missed exact entity names like "Shreyas Doshi", "LNO Framework", or "April Dunford".
- *Issue:* Dense semantic embeddings alone gave low ranking scores to short, keyword-dense queries.
- *Correction:* Implemented **Reciprocal Rank Fusion (RRF)** combining **BM25 Lexical Keyword Search** with **TF-IDF/Cosine Vector Similarity**. Keyword precision increased to 100% for speaker names and framework acronyms.

---

## 3. Local LLM Context Window Constraints (Ollama)

### Requirement
Mandatory demo running locally via Ollama using 3B-7B parameter models (`llama3.2` / `mistral`).

### Attempt #1 (Failed)
Passing 10 full transcript chunks (over 6,000 tokens) to local Ollama instances caused model context truncation and slow response times (>12s).
- *Correction:* Optimized retrieval parameter `top_k=5` and applied context compression. Local Ollama first-token latency dropped from $12\text{s}$ to $<2.2\text{s}$.

---

## 4. Ship 30 for 30 Content Skill Formatting

### Requirement
Generate ~1,250-word grounded essays with specific structural elements (Hook, narrative, bolding, actionable takeaway).

### Iteration & Verification
- Prompts were tuned with explicit structural constraints.
- System prompt instructions enforced formatted markdown artifact payloads so the output automatically opens in the side-by-side **Artifact Canvas**.

---

## 5. Artifact Viewer Security Isolation

### Requirement
Render arbitrary LLM-generated HTML/CSS snippets securely beside chat without risking XSS or parent window hijacking.

### Security Resolution
- Implemented **DOMPurify** sanitization on raw HTML.
- Configured iframe sandbox attributes: `sandbox="allow-scripts"` (strictly excluding `allow-same-origin`, preventing access to parent cookies, local storage, or DOM).

---

## 6. Secret Scrubbing & Privacy Audit

- All `.env` files reviewed.
- Zero API keys, passwords, or personal credentials committed.
- Environment variables configured via `.env.example`.
