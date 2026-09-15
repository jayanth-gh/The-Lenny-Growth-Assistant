import React, { useState } from 'react';
import { X, Search, BookOpen, ExternalLink, Loader2 } from 'lucide-react';
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
      <div className="modal-content" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--accent-primary)' }}>
            <Search size={18} />
            <span>Search Lenny's Podcast Transcripts</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search keywords, frameworks, or guests (e.g. 'Elena Verna PLG', 'Shreyas LNO')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            className="new-chat-btn"
            style={{ width: 'auto', padding: '0 20px' }}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-subtle)', padding: '30px 0' }}>
              {loading ? 'Searching transcripts...' : 'Enter a search term to find relevant podcast excerpts.'}
            </div>
          ) : (
            results.map((res, idx) => (
              <div key={idx} style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{res.episode_title}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>Guest: {res.guest_name}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '8px' }}>
                  {res.content}
                </p>
                <a
                  href={res.episode_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>View Episode Source</span>
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
