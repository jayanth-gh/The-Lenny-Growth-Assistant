import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ArtifactViewer } from './components/ArtifactViewer';
import { CitationModal } from './components/CitationModal';
import { TranscriptSearchModal } from './components/TranscriptSearchModal';

import {
  fetchSessions,
  createSession,
  deleteSession,
  fetchMessages,
  sendMessage,
  fetchModels
} from './api/client';

import { ChatSession, ChatMessage as ChatMessageType, Citation, Artifact, ModelsResponse } from './types';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('lenny-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const [provider, setProvider] = useState<string>('ollama');
  const [model, setModel] = useState<string>('llama3.2');
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);

  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('lenny-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const modelsRes = await fetchModels();
        setModelsData(modelsRes);
        if (modelsRes?.active_default) {
          setProvider(modelsRes.active_default.provider);
          setModel(modelsRes.active_default.model);
        }
      } catch (err) {
        console.warn('Could not fetch models data on startup:', err);
      }

      try {
        const sess = await fetchSessions();
        setSessions(sess);

        if (sess.length > 0) {
          setActiveSessionId(sess[0].id);
        } else {
          const newSess = await createSession('New Growth Session', provider, model);
          setSessions([newSess]);
          setActiveSessionId(newSess.id);
        }
      } catch (err) {
        console.warn('Could not fetch sessions on startup, will create on demand:', err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const sessionId = activeSessionId;
    if (sessionId == null) return;
    const safeSessionId: string = sessionId;

    async function loadMessages() {
      try {
        const msgs = await fetchMessages(safeSessionId);
        setMessages(msgs);

        const lastMsgWithArtifact = [...msgs].reverse().find(m => m.artifacts && m.artifacts.length > 0);
        if (lastMsgWithArtifact && lastMsgWithArtifact.artifacts.length > 0) {
          setActiveArtifact(lastMsgWithArtifact.artifacts[0]);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }

    loadMessages();
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewSession = async () => {
    try {
      const newSess = await createSession('New Growth Session', provider, model);
      setSessions(prev => [newSess, ...prev]);
      setActiveSessionId(newSess.id);
      setMessages([]);
      setActiveArtifact(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      const remaining = sessions.filter(s => s.id !== id);
      setSessions(remaining);
      if (activeSessionId === id) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          handleNewSession();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (customPrompt?: string, skillOverride?: string) => {
    const textToSend = customPrompt || inputPrompt;
    if (!textToSend.trim() || loading) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      try {
        const newSess = await createSession('New Growth Session', provider, model);
        setSessions(prev => [newSess, ...prev]);
        setActiveSessionId(newSess.id);
        targetSessionId = newSess.id;
      } catch (err) {
        console.error('Failed to create on-demand session:', err);
        return;
      }
    }

    setInputPrompt('');
    setLoading(true);

    const tempUserMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      session_id: targetSessionId,
      role: 'user',
      content: textToSend,
      citations: [],
      artifacts: [],
      model_used: `${provider}/${model}`,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const assistantResponse = await sendMessage(targetSessionId, textToSend, provider, model, skillOverride);
      setMessages(prev => [...prev, assistantResponse]);

      if (assistantResponse.artifacts && assistantResponse.artifacts.length > 0) {
        setActiveArtifact(assistantResponse.artifacts[0]);
      }

      const updatedSessions = await fetchSessions();
      setSessions(updatedSessions);
    } catch (err: any) {
      const errorMsg: ChatMessageType = {
        id: `err-${Date.now()}`,
        session_id: targetSessionId,
        role: 'assistant',
        content: `⚠️ Error executing request: ${err.message || 'Server connection failed'}. Please check if Ollama or Cloud API keys are configured properly.`,
        citations: [],
        artifacts: [],
        model_used: `${provider}/${model}`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" data-theme={theme}>
      <Navbar
        currentProvider={provider}
        currentModel={model}
        onProviderChange={(p, m) => {
          setProvider(p);
          setModel(m);
        }}
        modelsData={modelsData}
        onOpenSearch={() => setIsSearchOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme(current => (current === 'light' ? 'dark' : 'light'))}
      />

      <div className={`workspace ${activeArtifact ? 'has-artifact' : ''}`}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onSelectSkill={(prompt, skill) => handleSendMessage(prompt, skill)}
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        <main className="chat-section">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="eyebrow">PRODUCT &amp; GROWTH INTELLIGENCE</div>
                <h1>
                  Lenny <span>Growth</span>
                  <br />
                  Assistant
                </h1>
                <p>
                  Ask questions grounded in
                  <br />
                  Lenny's podcast transcripts.
                </p>

                <div className="prompt-grid">
                  <button
                    className="prompt-chip"
                    onClick={() => handleSendMessage('What does April Dunford say about positioning?')}
                  >
                    <span className="prompt-category">POSITIONING</span>
                    <span className="prompt-text">What does April Dunford say about positioning?</span>
                    <span className="prompt-arrow">→</span>
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => handleSendMessage('How does Elena Verna think about activation?')}
                  >
                    <span className="prompt-category">ACTIVATION</span>
                    <span className="prompt-text">How does Elena Verna think about activation?</span>
                    <span className="prompt-arrow">→</span>
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => handleSendMessage("Explain Shreyas Doshi's framework.")}
                  >
                    <span className="prompt-category">PRODUCT STRATEGY</span>
                    <span className="prompt-text">Explain Shreyas Doshi's framework.</span>
                    <span className="prompt-arrow">→</span>
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => handleSendMessage('Write a Ship 30 essay about product-led growth.', 'ship30')}
                  >
                    <span className="prompt-category">SHIP 30</span>
                    <span className="prompt-text">Write a Ship 30 essay about product-led growth.</span>
                    <span className="prompt-arrow">→</span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onOpenCitation={setSelectedCitation}
                  onOpenArtifact={setActiveArtifact}
                />
              ))
            )}

            {loading && (
              <div className="message-card assistant">
                <div className="message-bubble loading-bubble">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Searching Lenny's podcast transcripts and generating a grounded answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="input-box"
            >
              <textarea
                rows={1}
                placeholder="Ask any product, PLG, positioning, or growth question..."
                value={inputPrompt}
                onChange={e => setInputPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <button type="submit" className="send-btn" disabled={loading || !inputPrompt.trim()}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </main>

        {activeArtifact && (
          <ArtifactViewer
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
          />
        )}
      </div>

      <CitationModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />

      <TranscriptSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
