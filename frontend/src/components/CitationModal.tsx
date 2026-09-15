import React from 'react';
import { X, BookOpen, ExternalLink } from 'lucide-react';
import { Citation } from '../types';

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--accent-primary)' }}>
            <BookOpen size={18} />
            <span>Grounded Source Citation</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '4px' }}>
            {citation.episode_title}
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Guest: <strong style={{ color: 'var(--text-main)' }}>{citation.guest_name}</strong>
          </div>
        </div>

        <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
            Transcript Excerpt:
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontStyle: 'italic', lineHeight: 1.5 }}>
            "{citation.excerpt}"
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <a
            href={citation.episode_url}
            target="_blank"
            rel="noopener noreferrer"
            className="skill-pill"
            style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', textDecoration: 'none' }}
          >
            <span>Open Episode Webpage</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
