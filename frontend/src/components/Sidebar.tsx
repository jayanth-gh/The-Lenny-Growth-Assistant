import React from 'react';
import { Plus, MessageSquare, Trash2, BookOpen, Rocket, Layout, Sparkles } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onSelectSkill: (prompt: string, skillOverride?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSelectSkill,
}) => {
  return (
    <aside className="sidebar">
      <button className="new-chat-btn" onClick={onNewSession}>
        <Plus size={18} />
        <span>New Chat Session</span>
      </button>

      <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.6px' }}>
          Quick actions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="session-item"
            style={{ background: '#fff7ed', color: '#c2410c', borderColor: 'rgba(249, 115, 22, 0.12)' }}
            onClick={() => onSelectSkill('Write a Ship 30 for 30 essay on Product-Led Growth positioning', 'ship30')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Rocket size={14} />
              <span>Ship 30 essay</span>
            </div>
          </button>

          <button
            className="session-item"
            style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: 'rgba(37, 99, 235, 0.12)' }}
            onClick={() => onSelectSkill('Create an interactive HTML pricing calculator based on Lenny\'s monetization episodes', 'artifact')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layout size={14} />
              <span>Artifact tool</span>
            </div>
          </button>
        </div>
      </div>

      {/* Sessions History List */}
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Chat History
      </div>
      <div className="session-list">
        {sessions.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '20px' }}>
            No sessions yet.
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
              onClick={() => onSelectSession(s.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <MessageSquare size={14} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(s.id);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: '2px' }}
                title="Delete session"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
