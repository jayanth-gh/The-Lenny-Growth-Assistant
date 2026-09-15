import { ChatSession, ChatMessage, ModelsResponse, TranscriptSearchResult } from '../types';

const API_BASE = '/api';

export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_BASE}/chat/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function createSession(title?: string, provider: string = 'ollama', model: string = 'llama3.2'): Promise<ChatSession> {
  const res = await fetch(`${API_BASE}/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, provider, model })
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete session');
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function sendMessage(
  sessionId: string,
  message: string,
  provider: string = 'ollama',
  model: string = 'llama3.2',
  skillOverride?: string
): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      provider,
      model,
      skill_override: skillOverride
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to send message' }));
    throw new Error(err.detail || 'Failed to send message');
  }
  return res.json();
}

export async function executeShip30Skill(
  sessionId: string,
  topic: string,
  provider: string = 'ollama',
  model: string = 'llama3.2'
): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/chat/skills/ship30`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      topic,
      provider,
      model
    })
  });
  if (!res.ok) throw new Error('Failed to execute Ship 30 skill');
  return res.json();
}

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function searchTranscripts(query: string): Promise<TranscriptSearchResult[]> {
  const res = await fetch(`${API_BASE}/transcripts/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search transcripts');
  return res.json();
}
