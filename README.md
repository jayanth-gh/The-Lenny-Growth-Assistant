# The-Lenny-Growth-Assistant

A local-first product intelligence and transcript Q&A application for Lenny's podcast archive.

Supported default runtime:

- Provider: Ollama
- Model: llama3.2
- Agent layer: Pi Coding Agent
- Base URL: http://host.docker.internal:11434

The local request path is:

```text
FastAPI -> Pi Coding Agent RPC -> Ollama -> llama3.2
```

## What this system does

- Retrieves transcript context and answers using grounded citations
- Persists chat sessions and transcript metadata in PostgreSQL
- Provides a React chat interface with artifact viewing and transcript search
- Routes local requests through the Pi Coding Agent RPC bridge
- Keeps Ollama and `llama3.2` as the supported no-key configuration

## Fresh-clone startup

These are the complete Windows steps for a new evaluator. Docker Desktop and Ollama run on the host; PostgreSQL, the FastAPI app, and the Pi Coding Agent bridge run in Docker.

### 1) Install prerequisites

Install Git for Windows, Docker Desktop with Linux containers, Ollama for Windows, and Python 3.11+ if you want to run host-side tests. Keep Docker Desktop open.

```powershell
git --version
docker --version
docker compose version
ollama --version
```

### 2) Clone this repository

```powershell
cd $HOME\Documents
git clone https://github.com/jayanth-gh/The-Lenny-Growth-Assistant.git
cd .\The-Lenny-Growth-Assistant
git status
```

### 3) Install and test Ollama

If Ollama is not already running as a Windows app, run `ollama serve` in a separate PowerShell window. Then, from the repository window:

```powershell
ollama pull llama3.2
ollama list
```

The `llama3.2` model must appear. Do not install Mistral; it is not part of the supported configuration.

### 4) Create the environment file

```powershell
Copy-Item .env.example .env
```

The copied file already contains the supported local configuration:

```env
DEFAULT_LLM_PROVIDER=ollama
DEFAULT_LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://host.docker.internal:11434
PI_AGENT_URL=http://pi-agent:8090
```

No cloud API key is required. Keep `.env` private.

### 5) Build and start the complete stack

```powershell
docker compose up --build -d
docker compose ps
```

Wait for `lenny_postgres`, `lenny_pi_agent`, and `lenny_assistant_app` to show `healthy`, and for `lenny_frontend` to show `Up`.
No separate frontend server is required.

### 6) Open the application

Open [http://localhost:8000](http://localhost:8000). The public frontend proxies `/api/` requests to the internal FastAPI `app:8000` service. The Pi health endpoint is [http://localhost:8090/health](http://localhost:8090/health).

---

## Validation checklist

A fresh evaluator should verify the following before calling the app ready.

### Health endpoint

```bash
curl -sSf http://localhost:8000/health
```

Expected result:

```json
{"status":"healthy","service":"The Lenny Growth Assistant","version":"1.0.0"}
```

### Model defaults and agent layer

```powershell
$models = Invoke-RestMethod http://localhost:8000/api/models
$models.active_default | ConvertTo-Json
$models.providers.ollama | Select-Object agent_layer, status, available_models, base_url | ConvertTo-Json
```

Expected output:

```text
{'provider': 'ollama', 'model': 'llama3.2'}
healthy
http://host.docker.internal:11434
```

The Ollama provider metadata must also report `agent_layer` as `pi-coding-agent` and `status` as `healthy`.

The local request path is:

```text
FastAPI -> Pi Coding Agent RPC -> Ollama -> llama3.2
```

The Pi bridge is available at `http://localhost:8090/health` and should report:

```json
{"status":"healthy","agent":"pi-coding-agent","provider":"ollama","model":"llama3.2"}
```

No Anthropic or other cloud API key is required for the supported local path.

### Artifact security

Generated HTML is treated as untrusted. The Artifact Viewer:

- removes scripts, iframes, forms, external links, embedded objects, and inline event handlers with DOMPurify
- renders HTML in an opaque-origin iframe with `sandbox="allow-scripts"`, so widget scripts can run but cannot access the parent application
- permits only widget interaction handlers needed for local controls; network, forms, external resources, and parent access remain blocked by the iframe sandbox and CSP
- sanitizes Markdown after parsing before using `dangerouslySetInnerHTML`
- keeps the original source available only through the explicit Code, Copy, and Download actions

This allows layout, text, CSS, and safe form-like visual markup while blocking active content and network/navigation behavior.

---

## End-to-end chat smoke test

Run this PowerShell test after startup to prove the request travels through Pi to Ollama:

```powershell
$session = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/chat/sessions -ContentType 'application/json' -Body '{"title":"Fresh clone test","provider":"ollama","model":"llama3.2"}'
$body = @{ session_id = $session.id; message = 'What is product-led growth? Answer using the transcript knowledge base.'; provider = 'ollama'; model = 'llama3.2' } | ConvertTo-Json
$response = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/chat/send -ContentType 'application/json' -Body $body
$response | Select-Object model_used, skill_executed, content | ConvertTo-Json -Depth 4
```

The response must contain:

```text
model_used: pi/ollama/llama3.2
```

Then confirm Ollama loaded the model:

```powershell
ollama ps
```

---

## Automated tests

The Docker smoke test above is the authoritative fresh-clone validation because it exercises PostgreSQL, Pi, Ollama, and FastAPI together. For an optional host-side unit test:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
$env:PYTHONPATH = '.'
python -m pytest tests\test_agent_skills.py -q
```

---

## Troubleshooting

### Ollama is unreachable

```bash
ollama serve
ollama pull llama3.2
```

Then confirm the host is reachable from the container:

```bash
docker exec -it lenny_assistant_app ping host.docker.internal
```

### PostgreSQL startup issues

```bash
docker compose ps
docker compose logs db
```

If a conflict occurs, stop the local Postgres service or change the published port in `docker-compose.yml`.

### Wrong model used

The app intentionally normalizes the local provider to `llama3.2`, so any drift back to another local model is rejected. This makes the runtime behavior match the canonical config.

### Pi agent is unavailable

```bash
docker compose logs pi-agent
docker compose restart pi-agent app
```

The app waits for the Pi bridge health check before starting. A successful chat response reports `model_used` as `pi/ollama/llama3.2`.

### Stop, restart, or reset the stack

```powershell
# Stop containers but keep PostgreSQL data
docker compose down

# Start again without rebuilding
docker compose up -d

# Rebuild after code or dependency changes
docker compose up --build -d

# Delete containers and the PostgreSQL volume for a completely fresh database
docker compose down -v
```

---

## Key project files

- `backend/app/core/config.py` — single source of truth for defaults
- `backend/app/services/llm_provider.py` — provider normalization and Pi-backed local provider calls
- `pi-agent/server.mjs` — Pi Coding Agent RPC bridge configured for Ollama
- `backend/app/api/routes/chat.py` — request routing and local default enforcement
- `backend/app/services/rag_engine.py` — retrieval and citation grounding
- `frontend/src/App.tsx` — main UI and local-first chat experience

---

## Handoff note

A fresh evaluator should be able to clone the repo, install dependencies, start Ollama, run Docker Compose, and verify the health endpoints and model defaults without any hidden setup steps. The requested local-first default is enforced and documented in this README and the project’s engineering handoff document.
