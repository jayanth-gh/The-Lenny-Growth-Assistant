import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./lenny_growth.db")

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.services.llm_provider import LLMFactory, ClaudeAgentService


def test_ollama_factory_ignores_invalid_model_override():
    provider = LLMFactory.get_provider("ollama", "mistral")
    assert provider.model_name == "llama3.2"


def test_claude_agent_service_exists_and_uses_anthropic_default():
    agent = ClaudeAgentService()
    assert agent.provider_name == "anthropic"
    assert agent.model_name == "claude-3-5-sonnet-20241022"


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data

@pytest.mark.asyncio
async def test_models_list():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert "ollama" in data["providers"]
    assert "anthropic" in data["providers"]
    assert "openai" in data["providers"]

@pytest.mark.asyncio
async def test_create_and_list_sessions():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create session
        create_res = await ac.post("/api/chat/sessions", json={"title": "Test PLG Session", "provider": "ollama", "model": "llama3.2"})
        assert create_res.status_code == 201
        session_data = create_res.json()
        assert session_data["title"] == "Test PLG Session"
        session_id = session_data["id"]

        # List sessions
        list_res = await ac.get("/api/chat/sessions")
        assert list_res.status_code == 200
        sessions = list_res.json()
        assert any(s["id"] == session_id for s in sessions)

