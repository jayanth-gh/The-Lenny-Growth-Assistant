# System Architecture Specification

**Product:** The Lenny Growth Assistant  
**Version:** 1.0.0  
**Target Infrastructure:** Docker Compose / Linux / macOS / Windows WSL2  

---

## 1. System Overview & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND LAYER (React + Vite)                            │
│  ┌──────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │ Main Chat View       │   │ Side-by-Side Artifact   │   │ Model Config &          │  │
│  │ & Message Stream     │   │ Sandboxed IFrame Viewer │   │ Citation Excerpt Modal  │  │
│  └──────────┬───────────┘   └────────────▲────────────┘   └─────────────────────────┘  │
└─────────────┼────────────────────────────┼─────────────────────────────────────────────┘
              │ HTTP / JSON API            │ Artifact Payloads
┌─────────────▼────────────────────────────┴─────────────────────────────────────────────┐
│                               BACKEND API LAYER (FastAPI)                              │
│  ┌──────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │ Chat & Sessions API  │   │ Model Config Router     │   │ Health & Telemetry      │  │
│  └──────────┬───────────┘   └────────────┬────────────┘   └─────────────────────────┘  │
│             │                            │                                             │
│  ┌──────────▼────────────────────────────▼────────────┐                                 │
│  │               AGENTIC ROUTER & SKILLS LAYER        │                                 │
│  │  ┌──────────────────┐  ┌─────────────────────────┐ │                                 │
│  │  │ Grounded Q&A     │  │ Ship 30 for 30 Skill    │ │                                 │
│  │  │ Agent (Cites)    │  │ (~1250w Essay Generator)│ │                                 │
│  │  └────────┬─────────┘  └────────────┬────────────┘ │                                 │
│  └───────────┼─────────────────────────┼──────────────┘                                 │
│              │ Context                 │ Generation                                     │
│  ┌───────────▼─────────────────────────▼──────────────┐                                 │
│  │           HYBRID RAG RETRIEVAL ENGINE              │                                 │
│  │  ┌──────────────────┐  ┌─────────────────────────┐ │                                 │
│  │  │ BM25 Lexical     │  │ Vector Similarity       │ │                                 │
│  │  │ Search           │  │ (Sentence-Transformers) │ │                                 │
│  │  └────────┬─────────┘  └────────────┬────────────┘ │                                 │
│  └───────────┼─────────────────────────┼──────────────┘                                 │
│              └────────────┬────────────┘                                                │
└───────────────────────────┼────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────────────────────────────┐
│                              LLM PROVIDER ABSTRACTION                                  │
│       ┌────────────────────────────────┬─────────────────────────────────┐             │
│       │ Local LLM Provider (Ollama)    │ Cloud LLM Provider (Anthropic)  │             │
│       │ http://localhost:11434         │ Claude 3.5 Sonnet / OpenAI      │             │
│       └────────────────────────────────┴─────────────────────────────────┘             │
└────────────────────────────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────────────────────────────┐
│                            PERSISTENCE LAYER (PostgreSQL)                              │
│   ┌───────────────────┐     ┌───────────────────┐     ┌────────────────────────────┐   │
│   │ chat_sessions     │     │ chat_messages     │     │ transcript_chunks          │   │
│   └───────────────────┘     └───────────────────┘     └────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database ER Schema (PostgreSQL)

```sql
-- Extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Chat Sessions Table
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    provider_config JSONB NOT NULL DEFAULT '{"provider": "ollama", "model": "llama3.2"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_metadata JSONB DEFAULT '{}'
);

-- 2. Chat Messages Table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',
    artifacts JSONB DEFAULT '[]',
    token_count INT DEFAULT 0,
    model_used VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transcript Chunks Table (RAG Knowledge Base)
CREATE TABLE transcript_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_title VARCHAR(255) NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    episode_url TEXT NOT NULL,
    publish_date VARCHAR(50),
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    topics VARCHAR(255)[],
    embedding vector(384),
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance retrieval
CREATE INDEX idx_messages_session ON chat_messages(session_id);
CREATE INDEX idx_transcripts_tsvector ON transcript_chunks USING GIN(search_vector);
```

---

## 3. REST API Specification (FastAPI)

### 3.1 Session & Chat Endpoints

#### `POST /api/sessions`
Creates a new chat session.
- **Request Body:**
  ```json
  {
    "title": "PLG Strategy Session",
    "provider": "ollama",
    "model": "llama3.2"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": "c7a8e2b1-4f21-49a8-9d22-1f3a2b4c5d6e",
    "title": "PLG Strategy Session",
    "provider_config": {"provider": "ollama", "model": "llama3.2"},
    "created_at": "2026-09-13T22:30:00Z"
  }
  ```

#### `POST /api/chat`
Sends a message to the assistant and streams or returns the grounded response.
- **Request Body:**
  ```json
  {
    "session_id": "c7a8e2b1-4f21-49a8-9d22-1f3a2b4c5d6e",
    "message": "How does Elena Verna define Product-Led Growth metrics?",
    "provider": "ollama",
    "model": "llama3.2",
    "skill_override": null
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": "e9b2c3d4-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
    "role": "assistant",
    "content": "Elena Verna emphasizes that Product-Led Growth (PLG) relies on the product itself driving acquisition, retention, and expansion...",
    "citations": [
      {
        "episode_title": "Elena Verna on PLG and Growth Engineering",
        "guest_name": "Elena Verna",
        "episode_url": "https://www.lennyspodcast.com/elena-verna/",
        "excerpt": "PLG isn't just self-serve signups; it's an end-to-end organizational model..."
      }
    ],
    "artifacts": [],
    "model_used": "ollama/llama3.2"
  }
  ```

#### `POST /api/chat/skills/ship30`
Triggers the Ship 30 for 30 Content Skill to generate a ~1,250-word grounded essay.
- **Request Body:**
  ```json
  {
    "session_id": "c7a8e2b1-4f21-49a8-9d22-1f3a2b4c5d6e",
    "topic": "Product Positioning and Finding Initial Traction",
    "target_word_count": 1250
  }
  ```

---

## 4. Ingestion & RAG Retrieval Flow

1. **Transcript Loading & Chunking:**
   - Raw podcast transcripts are broken into coherent chunks of $\sim 400 - 600$ words with $100$-word overlaps.
   - Metadata tags (`episode_title`, `guest_name`, `episode_url`, `publish_date`) are bound to each chunk.
2. **Hybrid Indexing (Lexical + Semantic):**
   - **Lexical Search:** PostgreSQL `tsvector` with English stemming allows exact matches for names (e.g., "Shreyas Doshi", "Marty Cagan", "B2B SaaS").
   - **Semantic Search:** Text embeddings generated using `all-MiniLM-L6-v2` (384 dimensions) stored in `pgvector`.
3. **Retrieval & Citation Tagging:**
   - On query execution, top-$K$ chunks ($K=5$) are retrieved using Reciprocal Rank Fusion (RRF) combining BM25 and vector similarity scores.
   - Citation references are embedded into the LLM system prompt context, enforcing explicit citation formatting.

---

## 5. Dual LLM Provider Architecture & Fallback Engine

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_response(
        self, prompt: str, system_prompt: str, temperature: float = 0.2
    ) -> LLMResponse:
        pass

class OllamaProvider(BaseLLMProvider):
    """Local LLM Provider via Ollama API (http://localhost:11434)"""

class AnthropicProvider(BaseLLMProvider):
    """Cloud LLM Provider via Anthropic Claude API"""

class LLMFactory:
    @staticmethod
    def get_provider(provider_type: str, model_name: str) -> BaseLLMProvider:
        if provider_type == "ollama":
            return OllamaProvider(model=model_name)
        elif provider_type == "anthropic":
            return AnthropicProvider(model=model_name)
        ...
```

### Fallback Logic:
- If `Ollama` is selected but the daemon is unreachable (`ConnectionRefusedError`), the backend catches the error gracefully, attempts a fallback to a secondary configured cloud provider or returns a structured error response with actionable instructions (`"Ollama daemon not detected on port 11434. Please start Ollama or switch provider."`).

---

## 6. Artifact Security & Sandboxing

HTML/CSS artifacts generated by the assistant are rendered safely on the client side using a multi-layer isolation strategy:

1. **DOMPurify Sanitization:** Incoming HTML string is parsed and sanitized to strip inline event handlers (`onclick`, `onload`), `<script>` tags targeting outer scope, and iframe escape attempts.
2. **Sandboxed `<iframe>` Container:**
   - `sandbox="allow-scripts"` (Strictly omits `allow-same-origin`, preventing access to `window.parent`, local storage, cookies, or session state).
   - Rendered using `srcdoc` to ensure zero cross-site origin leaking.

---

## 7. Deployment Topology (Docker Compose)

```yaml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: lenny_postgres
    environment:
      POSTGRES_DB: lenny_growth_db
      POSTGRES_USER: lenny_user
      POSTGRES_PASSWORD: lenny_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lenny_user -d lenny_growth_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    container_name: lenny_assistant_app
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://lenny_user:lenny_password@db:5432/lenny_growth_db
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    depends_on:
      db:
        condition: service_healthy

volumes:
  postgres_data:
```
