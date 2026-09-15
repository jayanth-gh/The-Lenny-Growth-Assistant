import React from 'react';
import { Plus, MessageSquare, Trash2, Rocket, Layout, FileBox } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onSelectSkill: (prompt: string, skillOverride?: string) => void;
  onOpenSearch: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSelectSkill,
  onOpenSearch,
}) => {
  return (
    <aside className="sidebar">
      <button type="button" className="new-chat-btn" onClick={onNewSession}>
        <Plus size={16} />
        <span>New conversation</span>
      </button>

      <div className="workspace-section">
        <div className="section-label">WORKSPACE</div>
        <div className="workspace-actions">
          <button
            type="button"
            className="workspace-action"
            onClick={() => onSelectSkill('Write a Ship 30 for 30 essay on Product-Led Growth positioning', 'ship30')}
          >
            <Rocket size={14} />
            <span>Ship 30</span>
          </button>

          <button
            type="button"
            className="workspace-action"
            onClick={() => onSelectSkill('Create an interactive HTML pricing calculator based on Lenny\'s monetization episodes', 'artifact')}
          >
            <FileBox size={14} />
            <span>Artifact tool</span>
          </button>

          <button
            type="button"
            className="workspace-action"
            onClick={onOpenSearch}
          >
            <Layout size={14} />
            <span>Transcript Search</span>
          </button>
        </div>
      </div>

      <div className="section-label sessions-label">RECENT</div>
      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-session-copy">No sessions yet.</div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
              onClick={() => onSelectSession(s.id)}
            >
              <div className="session-main">
                <MessageSquare size={13} />
                <span>{s.title}</span>
              </div>
              <button
                type="button"
                className="session-delete"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteSession(s.id);
                }}
                title="Delete session"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
