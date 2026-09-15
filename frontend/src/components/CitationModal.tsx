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
      <div className="modal-content citation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <BookOpen size={18} />
            <span>Grounded source citation</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close citation">
            <X size={18} />
          </button>
        </div>

        <div className="citation-modal-body">
          <h3>{citation.episode_title}</h3>
          <div className="citation-meta">
            Guest: <strong>{citation.guest_name}</strong>
          </div>
        </div>

        <div className="quote-block">
          <div className="quote-label">Transcript excerpt</div>
          <p>“{citation.excerpt}”</p>
        </div>

        <div className="modal-actions">
          <a
            href={citation.episode_url}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-link"
          >
            <span>Open episode source</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
