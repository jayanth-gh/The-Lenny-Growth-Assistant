from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import httpx
import logging

try:
    import anthropic
except ImportError:  # pragma: no cover - optional dependency for cloud agent mode
    anthropic = None

from backend.app.core.config import settings

logger = logging.getLogger("lenny_assistant.llm_provider")


def normalize_provider(provider_type: Optional[str]) -> str:
    provider = (provider_type or settings.default_llm_provider or "ollama").strip().lower()
    return provider if provider in {"ollama", "anthropic", "openai"} else settings.default_llm_provider


def normalize_ollama_model_name(model_name: Optional[str]) -> str:
    if not model_name:
        return settings.default_llm_model
    cleaned = model_name.strip().lower()
    if ":" in cleaned:
        left, _, _ = cleaned.partition(":")
        cleaned = left
    if not cleaned:
        return settings.default_llm_model
    return cleaned


def normalize_model(provider_type: Optional[str], model_name: Optional[str] = None) -> str:
    provider = normalize_provider(provider_type)

    if provider == "ollama":
        default_model = settings.default_llm_model
        requested = normalize_ollama_model_name(model_name)
        return requested if requested == default_model else default_model

    if provider == "anthropic":
        custom_model = (model_name or settings.CLOUD_LLM_MODEL or "claude-3-5-sonnet-20241022").strip()
        return custom_model or "claude-3-5-sonnet-20241022"

    if provider == "openai":
        custom_model = (model_name or "gpt-4o").strip()
        return custom_model or "gpt-4o"

    return settings.default_llm_model


class LLMResponse:
    def __init__(self, content: str, model_used: str, raw_response: Optional[Dict[str, Any]] = None):
        self.content = content
        self.model_used = model_used
        self.raw_response = raw_response or {}


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048
    ) -> LLMResponse:
        pass

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        pass


class ClaudeAgentService(BaseLLMProvider):
    """Anthropic-backed agent layer kept as an optional cloud implementation.

    The app still defaults to Ollama + llama3.2 for the local demo, but this service
    provides the required Anthropic SDK-backed agent path when an API key is provided.
    """

    def __init__(self, model_name: Optional[str] = None, api_key: Optional[str] = None):
        self.provider_name = "anthropic"
        self.model_name = (model_name or settings.CLOUD_LLM_MODEL or "claude-3-5-sonnet-20241022").strip()
        self.api_key = api_key or settings.ANTHROPIC_API_KEY

    async def check_health(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"status": "unconfigured", "provider": self.provider_name, "message": "ANTHROPIC_API_KEY missing"}
        return {"status": "configured", "provider": self.provider_name, "model": self.model_name}

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        if not self.api_key:
            raise ValueError("Anthropic API key is not configured in environment or settings.")

        if anthropic is not None:
            client = anthropic.Anthropic(api_key=self.api_key)
            message = client.messages.create(
                model=self.model_name,
                system=system_prompt or "You are Lenny Growth Assistant.",
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            content = ""
            for block in getattr(message, "content", []):
                if hasattr(block, "text"):
                    content += block.text
            if not content:
                content = str(message)
            return LLMResponse(content=content, model_used=f"anthropic/{self.model_name}", raw_response={"sdk": "anthropic"})

        # Fallback path used when the Anthropic SDK is not installed in the runtime.
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt or "You are Lenny Growth Assistant.",
            "messages": [{"role": "user", "content": prompt}],
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data["content"][0]["text"]
                return LLMResponse(content=content, model_used=f"anthropic/{self.model_name}", raw_response=data)
            raise RuntimeError(f"Anthropic API Error ({res.status_code}): {res.text}")


class OllamaProvider(BaseLLMProvider):
    def __init__(self, model_name: Optional[str] = None, base_url: Optional[str] = None):
        self.model_name = normalize_model("ollama", model_name)
        self.base_url = (base_url or settings.ollama_base_url or "http://host.docker.internal:11434").rstrip("/")
        self.agent_url = settings.pi_agent_url

    async def check_health(self) -> Dict[str, Any]:
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    payload = res.json() if res.content else {}
                    raw_models = [m.get("name") for m in payload.get("models", []) if isinstance(m, dict)]
                    models = []
                    seen = set()
                    for name in raw_models:
                        normalized = normalize_ollama_model_name(name)
                        if normalized and normalized not in seen:
                            seen.add(normalized)
                            models.append(normalized)
                    return {
                        "status": "healthy" if self.model_name in models else "model_missing",
                        "provider": "ollama",
                        "configured_model": self.model_name,
                        "available_models": models,
                        "base_url": self.base_url,
                    }
                return {
                    "status": "error",
                    "provider": "ollama",
                    "configured_model": self.model_name,
                    "base_url": self.base_url,
                    "error": f"Ollama server returned HTTP {res.status_code} at {url}"
                }
        except httpx.ConnectError as exc:
            logger.warning(f"Ollama health check failed at {self.base_url}: {exc}")
        return {
            "status": "unreachable",
            "provider": "ollama",
            "configured_model": self.model_name,
            "error": f"Ollama is unavailable. Make sure Ollama is running and accessible at {self.base_url}.",
            "base_url": self.base_url
        }

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048
    ) -> LLMResponse:
        if self.agent_url:
            try:
                async with httpx.AsyncClient(timeout=settings.ollama_request_timeout_seconds) as client:
                    response = await client.post(
                        f"{self.agent_url}/generate",
                        json={
                            "prompt": prompt,
                            "system_prompt": system_prompt,
                            "temperature": temperature,
                            "max_tokens": min(int(max_tokens), settings.ollama_max_output_tokens)
                        }
                    )
                if response.status_code == 200:
                    data = response.json()
                    return LLMResponse(
                        content=data.get("content", ""),
                        model_used=data.get("model_used", f"pi/ollama/{self.model_name}"),
                        raw_response=data
                    )
                raise RuntimeError(response.json().get("error", response.text))
            except httpx.ConnectError as exc:
                raise RuntimeError(f"Pi coding agent is unavailable at {self.agent_url}.") from exc
            except httpx.ReadTimeout as exc:
                raise RuntimeError(
                    "Pi took too long to generate this artifact. Please retry with a smaller widget request."
                ) from exc

        url = f"{self.base_url}/api/generate"
        request_timeout = settings.ollama_request_timeout_seconds
        effective_max_tokens = min(int(max_tokens), settings.ollama_max_output_tokens)

        full_prompt = prompt
        if system_prompt:
            full_prompt = f"System: {system_prompt}\n\nUser: {prompt}"

        try:
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                tags = await client.get(f"{self.base_url}/api/tags", timeout=min(10.0, request_timeout))
                if tags.status_code != 200:
                    raise RuntimeError(f"Ollama is unavailable at {self.base_url}. Make sure Ollama is running and accessible at the configured URL.")

                available_models = []
                try:
                    raw = tags.json().get("models", [])
                    available_models = [normalize_ollama_model_name(m.get("name")) for m in raw if isinstance(m, dict) and m.get("name")]
                except Exception:
                    available_models = []

                if self.model_name not in available_models:
                    raise RuntimeError(f"Ollama model '{self.model_name}' is not installed. Run: ollama pull {self.model_name}")

                payload = {
                    "model": self.model_name,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": effective_max_tokens
                    }
                }
                response = await client.post(url, json=payload, timeout=request_timeout)
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("response", "")
                    return LLMResponse(content=content, model_used=f"ollama/{self.model_name}", raw_response=data)
                error_payload = response.text
                if response.status_code == 404:
                    raise RuntimeError(f"Ollama model '{self.model_name}' is not installed. Run: ollama pull {self.model_name}")
                raise RuntimeError(f"Ollama returned HTTP status {response.status_code}: {error_payload}")
        except httpx.ConnectError as exc:
            logger.error(f"Could not connect to Ollama at {self.base_url}")
            raise RuntimeError(f"Ollama is unavailable. Make sure Ollama is running and accessible at {self.base_url}.") from exc
        except httpx.ReadTimeout as exc:
            logger.error(f"Ollama call timed out for model '{self.model_name}' at {self.base_url} after {request_timeout}s")
            raise RuntimeError(
                f"Ollama timed out while generating a response for '{self.model_name}'. "
                f"The model may still be loading or the request is too large; please retry."
            ) from exc
        except RuntimeError:
            raise
        except Exception as exc:
            logger.error(f"Unexpected Ollama error for model '{self.model_name}': {exc}")
            raise RuntimeError(f"Unexpected Ollama response for model '{self.model_name}': {exc}") from exc


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, model_name: Optional[str] = None, api_key: Optional[str] = None):
        self.model_name = normalize_model("anthropic", model_name)
        self.api_key = api_key or settings.ANTHROPIC_API_KEY

    async def check_health(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"status": "unconfigured", "provider": "anthropic", "message": "ANTHROPIC_API_KEY missing"}
        return {"status": "configured", "provider": "anthropic", "model": self.model_name}

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048
    ) -> LLMResponse:
        if not self.api_key:
            raise ValueError("Anthropic API key is not configured in environment or settings.")

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        payload = {
            "model": self.model_name,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt or "You are Lenny Growth Assistant.",
            "messages": [{"role": "user", "content": prompt}]
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data["content"][0]["text"]
                return LLMResponse(content=content, model_used=f"anthropic/{self.model_name}", raw_response=data)
            raise RuntimeError(f"Anthropic API Error ({res.status_code}): {res.text}")


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, model_name: Optional[str] = None, api_key: Optional[str] = None):
        self.model_name = normalize_model("openai", model_name)
        self.api_key = api_key or settings.OPENAI_API_KEY

    async def check_health(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"status": "unconfigured", "provider": "openai", "message": "OPENAI_API_KEY missing"}
        return {"status": "configured", "provider": "openai", "model": self.model_name}

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048
    ) -> LLMResponse:
        if not self.api_key:
            raise ValueError("OpenAI API key is not configured in environment or settings.")

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                return LLMResponse(content=content, model_used=f"openai/{self.model_name}", raw_response=data)
            raise RuntimeError(f"OpenAI API Error ({res.status_code}): {res.text}")


class LLMFactory:
    @staticmethod
    def get_provider(provider_type: Optional[str] = "ollama", model_name: Optional[str] = None) -> BaseLLMProvider:
        provider_type = normalize_provider(provider_type)
        effective_model = normalize_model(provider_type, model_name)
        if provider_type == "anthropic":
            return ClaudeAgentService(model_name=effective_model)
        elif provider_type == "openai":
            return OpenAIProvider(model_name=effective_model)
        return OllamaProvider(model_name=effective_model)
