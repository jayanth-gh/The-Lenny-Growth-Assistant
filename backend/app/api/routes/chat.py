from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import ChatSession, ChatMessage
from backend.app.services.agent_router import GrowthAgentRouter
from backend.app.services.llm_provider import normalize_provider, normalize_model

router = APIRouter(prefix="/chat", tags=["chat"])
agent_router = GrowthAgentRouter()


def resolve_provider(provider: Optional[str]) -> str:
    return normalize_provider(provider or settings.default_llm_provider)


def resolve_model(provider: Optional[str], model: Optional[str]) -> str:
    effective_provider = resolve_provider(provider)
    if effective_provider == "ollama":
        return settings.default_llm_model
    return normalize_model(effective_provider, model)


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Growth Session"
    provider: Optional[str] = None
    model: Optional[str] = None


class SendMessageRequest(BaseModel):
    session_id: str
    message: str
    provider: Optional[str] = None
    model: Optional[str] = None
    skill_override: Optional[str] = None  # None | "ship30" | "artifact"


class Ship30SkillRequest(BaseModel):
    session_id: str
    topic: str
    provider: Optional[str] = None
    model: Optional[str] = None

@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(req: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    provider = resolve_provider(req.provider)
    model = resolve_model(provider, req.model)
    session = ChatSession(
        title=req.title,
        provider_config={"provider": provider, "model": model}
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "provider_config": session.provider_config,
        "created_at": session.created_at
    }

@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    stmt = select(ChatSession).order_by(ChatSession.updated_at.desc())
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "provider_config": s.provider_config,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        } for s in sessions
    ]

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted successfully"}

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
    res = await db.execute(stmt)
    messages = res.scalars().all()
    return [
        {
            "id": m.id,
            "session_id": m.session_id,
            "role": m.role,
            "content": m.content,
            "citations": m.citations or [],
            "artifacts": m.artifacts or [],
            "model_used": m.model_used,
            "created_at": m.created_at
        } for m in messages
    ]

@router.post("/send")
async def send_message(req: SendMessageRequest, db: AsyncSession = Depends(get_db)):
    provider = resolve_provider(req.provider)
    model = resolve_model(provider, req.model)

    # 1. Fetch Session
    stmt = select(ChatSession).where(ChatSession.id == req.session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        # Auto create session if not exists
        session = ChatSession(id=req.session_id, title=req.message[:30] + "...")
        db.add(session)
        await db.commit()

    # 2. Save User Message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=req.message,
        model_used=f"{provider}/{model}"
    )
    db.add(user_msg)
    await db.commit()

    # 3. Fetch chat history for context
    msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc())
    msg_res = await db.execute(msg_stmt)
    past_messages = msg_res.scalars().all()
    history = [{"role": m.role, "content": m.content} for m in past_messages]

    # 4. Agent Router Execution
    agent_response = await agent_router.execute(
        db=db,
        user_message=req.message,
        chat_history=history,
        provider_name=provider,
        model_name=model,
        skill_override=req.skill_override
    )

    # 5. Save Assistant Message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=agent_response.content,
        citations=agent_response.citations,
        artifacts=agent_response.artifacts,
        model_used=agent_response.model_used
    )
    db.add(assistant_msg)
    
    # Update Session Title if new
    if session.title == "New Growth Session" or session.title.startswith("New Chat"):
        session.title = req.message[:35] + ("..." if len(req.message) > 35 else "")
    session.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(assistant_msg)

    return {
        "id": assistant_msg.id,
        "session_id": assistant_msg.session_id,
        "role": assistant_msg.role,
        "content": assistant_msg.content,
        "citations": assistant_msg.citations,
        "artifacts": assistant_msg.artifacts,
        "model_used": assistant_msg.model_used,
        "skill_executed": agent_response.skill_executed,
        "created_at": assistant_msg.created_at
    }

@router.post("/skills/ship30")
async def execute_ship30_skill(req: Ship30SkillRequest, db: AsyncSession = Depends(get_db)):
    send_req = SendMessageRequest(
        session_id=req.session_id,
        message=f"Write a Ship 30 for 30 essay on: {req.topic}",
        provider=req.provider,
        model=req.model,
        skill_override="ship30"
    )
    return await send_message(send_req, db)
