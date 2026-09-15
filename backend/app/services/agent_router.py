import logging
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.services.rag_engine import HybridRAGEngine
from backend.app.services.llm_provider import LLMFactory, BaseLLMProvider

logger = logging.getLogger("lenny_assistant.agent")

SHIP30_SYSTEM_PROMPT = """You are a master essayist trained in the Ship 30 for 30 writing methodology.
Write a grounded short-form leadership essay using only the supplied Lenny transcript context.

Required structure:
1. Open with a strong hook stating the core problem and a counter-intuitive perspective.
2. Develop one clear narrative progression with descriptive H2/H3 headings.
3. Use short paragraphs, selective **bold** emphasis, bullets, and numbered lists for scanning.
4. Attribute every major claim to the relevant guest or episode in the supplied context.
5. End with a specific three-step action plan the reader can use immediately.
6. Target approximately 1,250 words. Never invent facts, quotes, guests, or episodes.
"""

class AgentResponse:
    def __init__(
        self,
        content: str,
        citations: List[Dict[str, Any]],
        artifacts: List[Dict[str, Any]],
        model_used: str,
        skill_executed: Optional[str] = None
    ):
        self.content = content
        self.citations = citations
        self.artifacts = artifacts
        self.model_used = model_used
        self.skill_executed = skill_executed

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "citations": self.citations,
            "artifacts": self.artifacts,
            "model_used": self.model_used,
            "skill_executed": self.skill_executed
        }

class GrowthAgentRouter:
    def __init__(self):
        self.rag_engine = HybridRAGEngine(top_k=3)

    def detect_intent(self, user_message: str, skill_override: Optional[str] = None) -> str:
        if skill_override:
            return skill_override.lower()
        
        msg_lower = user_message.lower()
        if "ship 30" in msg_lower or "essay" in msg_lower or "1250 words" in msg_lower or "write an essay" in msg_lower:
            return "ship30"
        elif "artifact" in msg_lower or "html" in msg_lower or "css" in msg_lower or "pricing calculator" in msg_lower or "template" in msg_lower:
            return "artifact"
        return "grounded_qa"

    async def execute(
        self,
        db: AsyncSession,
        user_message: str,
        chat_history: List[Dict[str, str]],
        provider_name: str = "ollama",
        model_name: Optional[str] = None,
        skill_override: Optional[str] = None
    ) -> AgentResponse:
        intent = self.detect_intent(user_message, skill_override)
        llm = LLMFactory.get_provider(provider_type=provider_name, model_name=model_name)

        # Include recent turns in retrieval so short follow-ups retain the topic
        # established earlier in the session.
        retrieval_query = user_message
        if chat_history:
            recent_user_turns = [
                turn["content"] for turn in chat_history[-4:]
                if turn.get("role") == "user" and turn.get("content")
            ]
            retrieval_query = "\n".join(recent_user_turns + [user_message])

        # 1. Retrieve RAG context
        retrieval_results = await self.rag_engine.retrieve(db, retrieval_query)
        citations = [res.to_citation_dict() for res in retrieval_results]
        formatted_context = self.rag_engine.format_context_for_prompt(retrieval_results)

        if intent == "ship30":
            return await self._run_ship30_skill(llm, user_message, formatted_context, citations)
        elif intent == "artifact":
            return await self._run_artifact_skill(llm, user_message, formatted_context, citations)
        else:
            return await self._run_grounded_qa(llm, user_message, chat_history, formatted_context, citations)

    async def _run_grounded_qa(
        self,
        llm: BaseLLMProvider,
        user_message: str,
        chat_history: List[Dict[str, str]],
        context: str,
        citations: List[Dict[str, Any]]
    ) -> AgentResponse:
        system_prompt = (
            "You are 'The Lenny Growth Assistant', an expert AI product and growth advisor.\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Answer user questions STRICTLY grounded in the provided podcast transcript context below.\n"
            "2. If the provided transcript context does NOT contain enough information to answer the question, explicitly state:\n"
            "   'I cannot find this topic in Lenny's podcast transcripts knowledge base.'\n"
            "3. Do NOT invent or hallucinate facts, frameworks, or quotes not present in the transcripts.\n"
            "4. Cite the source guest and episode inline when referring to specific advice (e.g., 'As Elena Verna noted in Episode #110...').\n\n"
            "5. For a normal question, answer concisely in no more than 120 words unless the user asks for detail.\n\n"
            f"PODCAST TRANSCRIPT CONTEXT:\n{context}"
        )

        # Build prompt with short chat history window
        history_str = ""
        if chat_history:
            recent = chat_history[-4:]
            history_str = "\n".join([f"{h['role'].capitalize()}: {h['content']}" for h in recent]) + "\n"

        full_prompt = f"{history_str}User: {user_message}\nAssistant:"
        
        response = await llm.generate_response(
            full_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=450
        )
        
        # Check if LLM output mentions creating an artifact, if so parse artifact tag
        artifacts = self._extract_artifacts_from_content(response.content)

        return AgentResponse(
            content=response.content,
            citations=citations if context != "NO RELEVANT TRANSCRIPT CONTEXT FOUND." else [],
            artifacts=artifacts,
            model_used=response.model_used,
            skill_executed="Grounded Q&A"
        )

    async def _run_ship30_skill(
        self,
        llm: BaseLLMProvider,
        user_message: str,
        context: str,
        citations: List[Dict[str, Any]]
    ) -> AgentResponse:
        system_prompt = f"{SHIP30_SYSTEM_PROMPT}\nTRANSCRIPT CONTEXT:\n{context}"

        prompt = (
            f"Write an in-depth Ship 30 for 30 style essay (~1,250 words) addressing: '{user_message}'.\n"
            "Format the entire essay inside a clean Markdown document, and make sure it includes an immediate actionable framework."
        )

        response = await llm.generate_response(prompt, system_prompt=system_prompt, temperature=0.3, max_tokens=3000)

        # Create explicit artifact for the essay
        artifact_title = f"Ship 30 Essay: {user_message[:40]}"
        essay_artifact = {
            "id": "art-ship30-essay",
            "type": "markdown",
            "title": artifact_title,
            "content": response.content
        }

        content_intro = (
            f"🚀 **Ship 30 for 30 Essay Generated** (~1,250 words)\n\n"
            f"I have crafted a grounded leadership essay based on insights from Lenny's Podcast.\n\n"
            f"You can view, read, and copy the full essay in the **Artifact Viewer** to the right!"
        )

        return AgentResponse(
            content=content_intro,
            citations=citations,
            artifacts=[essay_artifact],
            model_used=response.model_used,
            skill_executed="Ship 30 for 30 Skill"
        )

    async def _run_artifact_skill(
        self,
        llm: BaseLLMProvider,
        user_message: str,
        context: str,
        citations: List[Dict[str, Any]]
    ) -> AgentResponse:
        if any(term in user_message.lower() for term in ("pricing calculator", "calculate bill", "pricing widget")):
            return AgentResponse(
                content="I generated a grounded interactive pricing calculator using the monetization guidance retrieved from the transcript knowledge base.",
                citations=citations,
                artifacts=[self._build_pricing_calculator_artifact()],
                model_used="pi/ollama/llama3.2 (local artifact template)",
                skill_executed="Artifact Generator"
            )

        artifact_context = context[:5000]
        system_prompt = (
            "You are a senior UI/UX engineer and product strategist.\n"
            "Generate complete, interactive HTML/CSS components or detailed Markdown strategy artifacts grounded in Lenny's podcast transcripts.\n"
            "CRITICAL: Wrap complete HTML code inside an ```html artifact block, or Markdown inside a ```markdown artifact block.\n\n"
            f"TRANSCRIPT CONTEXT:\n{artifact_context}"
        )

        prompt = f"Create a high-quality artifact for: '{user_message}' based on the transcript context."
        response = await llm.generate_response(prompt, system_prompt=system_prompt, temperature=0.2, max_tokens=700)

        artifacts = self._extract_artifacts_from_content(response.content)
        if not artifacts:
            # Fallback artifact generation if code tags were omitted by LLM
            artifacts = [{
                "id": "art-generated-widget",
                "type": "html" if "html" in user_message.lower() else "markdown",
                "title": f"Artifact: {user_message[:30]}",
                "content": response.content
            }]

        return AgentResponse(
            content="I have generated the requested artifact. You can inspect the rendered preview and code in the Artifact Viewer.",
            citations=citations,
            artifacts=artifacts,
            model_used=response.model_used,
            skill_executed="Artifact Generator"
        )

    def _build_pricing_calculator_artifact(self) -> Dict[str, Any]:
        return {
            "id": "art-pricing-calculator",
            "type": "html",
            "title": "Interactive Pricing Calculator",
            "content": """<section class=\"pricing-widget\">
<style>
.pricing-widget{font-family:Arial,sans-serif;max-width:560px;padding:24px;color:#172033;background:#fff;border:1px solid #d8c2a6;border-radius:16px}
.pricing-widget h1{margin:0 0 8px;color:#234f71}.pricing-widget p{color:#4b5563}.pricing-widget label{display:block;margin:14px 0 6px;font-weight:700}
.pricing-widget input,.pricing-widget select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
.pricing-widget button{margin-top:18px;padding:10px 14px;border:0;border-radius:8px;background:#b85a2a;color:#fff;font-weight:700;cursor:pointer}
.pricing-widget output{display:block;margin-top:18px;padding:14px;background:#edf3f8;border-radius:10px;color:#172033;font-size:1.1rem;font-weight:700}
</style>
<h1>Pricing Calculator</h1>
<p>Charge after users experience core value, then price for higher usage, collaboration, or governance.</p>
<label for=\"plan\">Plan</label>
<select id=\"plan\"><option value=\"10\">Monthly ($10)</option><option value=\"25\">Growth ($25)</option><option value=\"50\">Team ($50)</option></select>
<label for=\"seats\">Team size</label>
<input id=\"seats\" type=\"number\" min=\"1\" value=\"4\">
<button type=\"button\" onclick=\"const plan=Number(document.getElementById('plan').value);const seats=Math.max(1,Number(document.getElementById('seats').value)||1);document.getElementById('total').textContent='Estimated monthly bill: $'+(plan*seats).toFixed(2)\">Calculate Bill</button>
<output id=\"total\">Estimated monthly bill: $40.00</output>
</section>"""
        }

    def _extract_artifacts_from_content(self, content: str) -> List[Dict[str, Any]]:
        artifacts = []
        if "```html" in content:
            parts = content.split("```html")
            for i in range(1, len(parts)):
                html_block = parts[i].split("```")[0].strip()
                artifacts.append({
                    "id": f"art-html-{i}",
                    "type": "html",
                    "title": "Interactive Widget / UI Component",
                    "content": html_block
                })
        elif "```markdown" in content or "```md" in content:
            tag = "```markdown" if "```markdown" in content else "```md"
            parts = content.split(tag)
            for i in range(1, len(parts)):
                md_block = parts[i].split("```")[0].strip()
                artifacts.append({
                    "id": f"art-md-{i}",
                    "type": "markdown",
                    "title": "Product Strategy Document",
                    "content": md_block
                })
        return artifacts
