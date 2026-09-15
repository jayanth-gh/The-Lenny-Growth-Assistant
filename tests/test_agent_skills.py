import pytest
from backend.app.services.agent_router import GrowthAgentRouter

def test_intent_detection():
    router = GrowthAgentRouter()
    
    assert router.detect_intent("Write a Ship 30 for 30 essay on PLG") == "ship30"
    assert router.detect_intent("Create an HTML artifact for pricing") == "artifact"
    assert router.detect_intent("How does Elena Verna define retention?") == "grounded_qa"

def test_artifact_extraction():
    router = GrowthAgentRouter()
    content = "Here is the widget:\n```html\n<div><button>Click Me</button></div>\n```"
    artifacts = router._extract_artifacts_from_content(content)
    assert len(artifacts) == 1
    assert artifacts[0]["type"] == "html"
    assert "button" in artifacts[0]["content"]
