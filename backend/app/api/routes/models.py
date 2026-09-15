from fastapi import APIRouter
from backend.app.services.llm_provider import OllamaProvider, AnthropicProvider, OpenAIProvider
from backend.app.core.config import settings

router = APIRouter(prefix="/models", tags=["models"])

@router.get("")
async def list_models():
    ollama_provider = OllamaProvider()
    anthropic_provider = AnthropicProvider()
    openai_provider = OpenAIProvider()

    ollama_health = await ollama_provider.check_health()
    anthropic_health = await anthropic_provider.check_health()
    openai_health = await openai_provider.check_health()

    return {
        "active_default": {
            "provider": settings.default_llm_provider,
            "model": settings.default_llm_model
        },
        "providers": {
            "ollama": {
                "name": "Ollama (Local LLM)",
                "agent_layer": "pi-coding-agent",
                "status": ollama_health.get("status"),
                "available_models": ollama_health.get("available_models", [settings.default_llm_model]),
                "requires_api_key": False,
                "base_url": settings.OLLAMA_BASE_URL
            },
            "anthropic": {
                "name": "Anthropic Claude (Cloud)",
                "status": anthropic_health.get("status"),
                "available_models": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
                "requires_api_key": True,
                "is_configured": bool(settings.ANTHROPIC_API_KEY)
            },
            "openai": {
                "name": "OpenAI GPT (Cloud)",
                "status": openai_health.get("status"),
                "available_models": ["gpt-4o", "gpt-4o-mini"],
                "requires_api_key": True,
                "is_configured": bool(settings.OPENAI_API_KEY)
            }
        }
    }
