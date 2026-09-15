# Client engineering handoff

This repository is a local-first transcript assistant for Lenny's podcast content. The supported default runtime is:

- Provider: Ollama
- Model: llama3.2
- Base URL: http://host.docker.internal:11434

The application still supports optional cloud providers, but the tested and supported local path is Ollama. The root cause fix for drift was to enforce one canonical local default across config, backend request handling, and the UI.

---

## 1) What the system does

The app combines:

- a FastAPI backend
- PostgreSQL persistence
- transcript retrieval and grounding
- an agent layer that routes to skills
- a React frontend for chat and artifact viewing
- a Pi Coding Agent RPC bridge configured to send requests to Ollama

Key behaviors:

- grounded answers use transcript context and cite sources
- chat sessions persist in the database
- model/provider selection is normalized to the canonical local default
- local runtime stays on llama3.2 unless explicitly changed at the configuration layer

---

## 2) Prerequisites

Install the following on the host machine before running the app:

- Docker Desktop or Docker Engine + Docker Compose
- Ollama

Optional but useful:

- a terminal with curl
- Python 3.11+

---

## 3) Fresh-clone run instructions

Use these steps on a new Windows laptop. The exact repository is:

```text
https://github.com/Sanjana28-a11y/The-Lenny-Growth-Assistant.git
```

Install Git for Windows, Docker Desktop with Linux containers, Ollama for Windows, and Python 3.11+ if host-side tests are needed. Verify:

```powershell
git --version
docker --version
docker compose version
ollama --version
```

Keep Docker Desktop running.

Clone the repository:

```powershell
cd $HOME\Documents
git clone https://github.com/Sanjana28-a11y/The-Lenny-Growth-Assistant.git
cd .\The-Lenny-Growth-Assistant
```

### Step 1: create a Python environment for optional tests

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

### Step 2: start Ollama and install the local model

```powershell
ollama serve
ollama pull llama3.2
```

This is required for the default local evaluation path. If the model is missing, the app will fail with a clear runtime error telling you to pull it.

### Step 3: create the environment file

```powershell
Copy-Item .env.example .env
```

The repository defaults are already set to the required configuration:

```env
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://host.docker.internal:11434
PI_AGENT_URL=http://pi-agent:8090
```

No cloud API key is required for the default local path.

### Step 4: bring the app up

```powershell
docker compose up --build -d
docker compose ps
```

This will start:

- PostgreSQL
- the Pi Coding Agent RPC bridge
- the FastAPI app
- the frontend bundle served from the app container

### Step 5: open the app

Open the browser at:

```text
http://localhost:8000
```

Pi health is available at `http://localhost:8090/health`.

---

## 4) Validation checklist

A fresh evaluator should verify all of the following before calling the run successful.

### Health

```bash
curl -sSf http://localhost:8000/health
```

Expected result:

```json
{"status":"healthy","service":"The Lenny Growth Assistant","version":"1.0.0"}
```

### Model metadata

```bash
curl -sSf http://localhost:8000/api/models
```

Expected model defaults:

- active_default.provider = ollama
- active_default.model = llama3.2
- providers.ollama.base_url = http://host.docker.internal:11434
- providers.ollama.agent_layer = pi-coding-agent

The Pi health endpoint should report provider `ollama` and model `llama3.2`.

### Direct runtime checks

```bash
curl -sSf http://localhost:8000/api/models | python -c "import sys, json; d=json.load(sys.stdin); print(d.get('active_default')); print(d.get('providers', {}).get('ollama', {}).get('status')); print(d.get('providers', {}).get('ollama', {}).get('base_url'))"
```

Expected output:

```text
{'provider': 'ollama', 'model': 'llama3.2'}
healthy
http://host.docker.internal:11434
```

### End-to-end smoke test

Create a session and send a message with provider `ollama` and model `llama3.2`. The response must report `model_used` as `pi/ollama/llama3.2`. Then run `ollama ps` and confirm `llama3.2` is loaded.

### Artifact security

Generated HTML is untrusted. The viewer sanitizes dangerous tags and attributes with DOMPurify and renders the result in an opaque-origin iframe with `sandbox="allow-scripts"`, allowing local widget controls while blocking parent access. A restrictive CSP blocks network and external resources, and forms are blocked. Parsed Markdown is sanitized before insertion into the React DOM. The Code tab shows source without executing it; Copy and Download are explicit user actions.

### Automated tests

The Docker smoke test is the authoritative fresh-clone validation because it exercises PostgreSQL, Pi, Ollama, and FastAPI together. For an optional host-side unit test:

```powershell
$env:PYTHONPATH = '.'
python -m pytest tests\test_agent_skills.py -q
```

---

## 5) Test strategy and representative checks

The repo includes functional tests for API health, model listing, and session creation. In practice, a client engineer should also do a minimal end-to-end prompt check after startup.

Recommended smoke test:

1. confirm the app loads at http://localhost:8000
2. confirm the model screen shows Ollama + llama3.2 as the default
3. ask a grounded question about a transcript topic
4. verify the answer includes citations or transcript-backed references
5. confirm the app still responds after a normal session creation flow

If the app is being extended, include a final check that provider/model drift is still blocked for the local path.

---

## 6) Common troubleshooting

### Ollama is unreachable

Symptoms:

- `/api/models` shows `unreachable`
- chat requests fail at runtime

Fix:

```bash
ollama serve
ollama pull llama3.2
```

Then confirm the host is reachable from the container:

```bash
docker exec -it lenny_assistant_app ping host.docker.internal
```

If that fails, Docker Desktop may not be running or the host alias may not be available in the compose environment.

### PostgreSQL startup issues

Check status:

```bash
docker compose ps
```

Inspect logs:

```bash
docker compose logs db
```

If the port is already in use, stop the conflict or change the published port in `docker-compose.yml`.

### Wrong model is selected

The app intentionally enforces the canonical local default for the local provider: `ollama/llama3.2`.

This is deliberate and is the root-cause fix for configuration drift across:

- Docker Compose
- backend settings
- LLM provider logic
- the local model request path
- the UI default display

### Cloud keys are missing

Cloud providers are optional. For the required local path, no cloud keys are needed.

---

## 7) Architecture and extension points

### Configuration

File: `backend/app/core/config.py`

This is the single source of truth for defaults. The default path is:

- `DEFAULT_LLM_PROVIDER=ollama`
- `DEFAULT_LLM_MODEL=llama3.2`
- `OLLAMA_BASE_URL=http://host.docker.internal:11434`

### Provider abstraction

File: `backend/app/services/llm_provider.py`

This layer is responsible for:

- normalizing provider names
- validating local model names
- health checking local vs cloud providers
- creating HTTP requests to Ollama or cloud APIs

If you add another provider, update this layer and its tests.

### Chat and routing

Files:

- `backend/app/api/routes/chat.py`
- `backend/app/services/agent_router.py`

This is where request-level routing, tool selection, and session logic live. It should continue to use the normalized provider/model values instead of trusting raw client input.

### Retrieval and grounding

File: `backend/app/services/rag_engine.py`

This is where transcript retrieval, ranking, and citation assembly happen. If you improve retrieval quality, validate both relevance and citation correctness.

### Frontend experience

Files:

- `frontend/src/App.tsx`
- `frontend/src/components/ArtifactViewer.tsx`
- `frontend/src/components/Navbar.tsx`

This layer should stay aligned with the backend defaults. The UI is intentionally simplified for the local-first demo experience.

---

## 8) Operational notes

- Treat Ollama + llama3.2 as the default supported local demo path.
- Keep cloud providers optional and unrequired in normal local evaluation.
- Prefer the repo defaults over hand-edited environment values.
- Validate both the HTTP endpoints and a real chat round-trip before handoff.
- Keep the default config in one place to avoid cross-layer drift and silent model-switching.

---

## 9) Working with this repo as a client engineer

The easiest path to maintainability is to keep the following rule in mind:

> If the request is to use a local demo path, the app must resolve to Ollama + llama3.2 and never silently drift to another local model.

That rule is enforced in the code and is the main guardrail for reproducibility and evaluator confidence.
