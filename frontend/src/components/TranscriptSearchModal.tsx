import React, { useState } from 'react';
import { X, Search, ExternalLink, Loader2 } from 'lucide-react';
import { searchTranscripts } from '../api/client';
import { TranscriptSearchResult } from '../types';

interface TranscriptSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TranscriptSearchModal: React.FC<TranscriptSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TranscriptSearchResult[]>([]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await searchTranscripts(query);
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content search-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Search size={18} />
            <span>Search Lenny's podcast</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search keywords, frameworks, or guests..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        <div className="search-results">
          {results.length === 0 ? (
            <div className="empty-session-copy">
              {loading ? 'Searching transcripts...' : 'Enter a search term to find relevant podcast excerpts.'}
            </div>
          ) : (
            results.map((res, idx) => (
              <div key={`${res.episode_title}-${idx}`} className="search-result-item">
                <div className="search-result-header">
                  <span className="search-result-title">{res.episode_title}</span>
                  <span className="search-result-guest">Guest: {res.guest_name}</span>
                </div>
                <p className="search-result-copy">{res.content}</p>
                <a className="search-result-link" href={res.episode_url} target="_blank" rel="noopener noreferrer">
                  <span>View episode source</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
