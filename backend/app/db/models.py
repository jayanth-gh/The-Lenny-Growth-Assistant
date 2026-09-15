import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False, default="New Growth Session")
    provider_config = Column(JSON, nullable=False, default={"provider": "ollama", "model": "llama3.2"})
    user_metadata = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user | assistant | system
    content = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True, default=[])
    artifacts = Column(JSON, nullable=True, default=[])
    token_count = Column(Integer, default=0)
    model_used = Column(String(100), nullable=False, default="ollama/llama3.2")
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    episode_title = Column(String(255), nullable=False)
    guest_name = Column(String(255), nullable=False)
    episode_url = Column(Text, nullable=False)
    publish_date = Column(String(50), nullable=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    topics = Column(JSON, nullable=True, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
