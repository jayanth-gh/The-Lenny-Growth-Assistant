import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Loader2, Rocket, Layout, BookOpen } from 'lucide-react';
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

  // Provider Settings State (Defaults to Ollama Local for mandatory demo requirements)
  const [provider, setProvider] = useState<string>('ollama');
  const [model, setModel] = useState<string>('llama3.2');
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);

  // UI Drawer/Modal States
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('lenny-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial sessions and models configuration
  useEffect(() => {
    async function init() {
      try {
        const modelsRes = await fetchModels();
        setModelsData(modelsRes);
      } catch (err) {
        console.warn("Could not fetch models data on startup:", err);
      }

      try {
        const sess = await fetchSessions();
        setSessions(sess);

        if (sess.length > 0) {
          setActiveSessionId(sess[0].id);
        } else {
          const newSess = await createSession("New Growth Session", provider, model);
          setSessions([newSess]);
          setActiveSessionId(newSess.id);
        }
      } catch (err) {
        console.warn("Could not fetch sessions on startup, will create on demand:", err);
      }
    }
    init();
  }, []);

  // Fetch messages when active session changes
  useEffect(() => {
    if (!activeSessionId) return;
    async function loadMessages() {
      try {
        const msgs = await fetchMessages(activeSessionId!);
        setMessages(msgs);
        
        // Auto open latest artifact if present
        const lastMsgWithArtifact = [...msgs].reverse().find(m => m.artifacts && m.artifacts.length > 0);
        if (lastMsgWithArtifact && lastMsgWithArtifact.artifacts.length > 0) {
          setActiveArtifact(lastMsgWithArtifact.artifacts[0]);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    }
    loadMessages();
  }, [activeSessionId]);

  // Scroll chat to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewSession = async () => {
    try {
      const newSess = await createSession("New Growth Session", provider, model);
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
        const newSess = await createSession("New Growth Session", provider, model);
        setSessions(prev => [newSess, ...prev]);
        setActiveSessionId(newSess.id);
        targetSessionId = newSess.id;
      } catch (err) {
        console.error("Failed to create on-demand session:", err);
        return;
      }
    }

    setInputPrompt('');
    setLoading(true);

    // Optimistic User Message
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
      const assistantResponse = await sendMessage(
        targetSessionId,
        textToSend,
        provider,
        model,
        skillOverride
      );

      setMessages(prev => [...prev, assistantResponse]);

      // If response contained an artifact, open it in Artifact Canvas
      if (assistantResponse.artifacts && assistantResponse.artifacts.length > 0) {
        setActiveArtifact(assistantResponse.artifacts[0]);
      }

      // Update sessions list title
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
      {/* Top Navbar */}
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
        onToggleTheme={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
      />

      {/* Main Workspace */}
      <div className="workspace">
        {/* Left Sidebar */}
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onSelectSkill={(prompt, skill) => handleSendMessage(prompt, skill)}
        />

        {/* Center Chat View */}
        <main className="chat-section">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', width: '100%', maxWidth: '760px', padding: '28px 18px 12px' }}>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e7e1d8',
                    borderRadius: '24px',
                    padding: '28px 28px 22px',
                    boxShadow: '0 10px 26px rgba(28, 26, 23, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    <div style={{ background: '#f3ece4', border: '1px solid #e7d8c6', padding: '10px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={22} color="#b8652d" />
                    </div>
                  </div>

                  <h2 style={{ fontFamily: 'Georgia, Times New Roman, serif', fontSize: '2rem', fontWeight: 700, marginBottom: '10px', textAlign: 'center', letterSpacing: '-0.03em' }}>
                    The Lenny Growth Assistant
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '22px', lineHeight: 1.7, textAlign: 'center', maxWidth: '620px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Ask product and growth questions, explore transcript insights, and build a working artifact in one flow.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: '12px' }}>
                    <button
                      className="skill-pill"
                      style={{ justifyContent: 'center', padding: '16px 14px', minHeight: '72px', borderRadius: '18px', background: '#ffffff', fontSize: '0.94rem' }}
                      onClick={() => handleSendMessage("How does Elena Verna define Product-Led Growth (PLG) and retention loops?")}
                    >
                      How does Elena Verna define PLG and retention loops?
                    </button>
                    <button
                      className="skill-pill"
                      style={{ justifyContent: 'center', padding: '16px 14px', minHeight: '72px', borderRadius: '18px', background: '#ffffff', fontSize: '0.94rem' }}
                      onClick={() => handleSendMessage("Explain Shreyas Doshi's LNO framework for PM prioritization.")}
                    >
                      Explain Shreyas Doshi's LNO framework for PM prioritization.
                    </button>
                    <button
                      className="skill-pill"
                      style={{ justifyContent: 'center', padding: '16px 14px', minHeight: '72px', borderRadius: '18px', background: 'linear-gradient(135deg, #fff7ed, #eef5ff)', fontSize: '0.94rem', color: '#1f2937' }}
                      onClick={() => handleSendMessage("Write a Ship 30 for 30 essay on product positioning and initial market traction.", "ship30")}
                    >
                      Generate a Ship 30 essay
                    </button>
                    <button
                      className="skill-pill"
                      style={{ justifyContent: 'center', padding: '16px 14px', minHeight: '72px', borderRadius: '18px', background: 'linear-gradient(135deg, #edf5ff, #f5f3ff)', fontSize: '0.94rem', color: '#1f2937' }}
                      onClick={() => handleSendMessage("Create an interactive HTML pricing calculator based on Lenny's monetization episodes", "artifact")}
                    >
                      Build an interactive pricing artifact
                    </button>
                  </div>
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
                <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 size={18} className="animate-spin" color="#6366f1" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Searching Lenny's Podcast transcripts & generating grounded response...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Prompt Input Area */}
          <div className="input-area">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="input-box"
            >
              <textarea
                rows={1}
                placeholder="Ask any product, PLG, positioning, or growth question..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
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

        {/* Right Side-by-Side Artifact Drawer */}
        {activeArtifact && (
          <ArtifactViewer
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
          />
        )}
      </div>

      {/* Citation Details Modal */}
      <CitationModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />

      {/* Transcript Search Overlay */}
      <TranscriptSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
