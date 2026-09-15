import React from 'react';
import { marked } from 'marked';
import { BookOpen, ExternalLink, Layout, Copy, Check } from 'lucide-react';
import { ChatMessage as ChatMessageType, Citation, Artifact } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
  onOpenCitation: (citation: Citation) => void;
  onOpenArtifact: (artifact: Artifact) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onOpenCitation,
  onOpenArtifact,
}) => {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parsedMarkdown = React.useMemo(() => {
    if (isUser) return message.content;
    try {
      return marked.parse(message.content, { async: false }) as string;
    } catch {
      return message.content;
    }
  }, [message.content, isUser]);

  return (
    <div className={`message-card ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-bubble">
        {isUser ? (
          <div>{message.content}</div>
        ) : (
          <>
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: parsedMarkdown }}
            />

            {/* Render Artifact Triggers */}
            {message.artifacts && message.artifacts.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {message.artifacts.map((artifact, idx) => (
                  <button
                    key={artifact.id || idx}
                    className="artifact-trigger-btn"
                    onClick={() => onOpenArtifact(artifact)}
                  >
                    <Layout size={16} />
                    <span>View Generated Artifact: {artifact.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Grounded Citation Chips */}
            {message.citations && message.citations.length > 0 && (
              <div className="citations-container">
                <div style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Grounded Sources:
                </div>
                {message.citations.map((cite, idx) => (
                  <div
                    key={idx}
                    className="citation-chip"
                    onClick={() => onOpenCitation(cite)}
                    title="Click to view transcript excerpt"
                  >
                    <BookOpen size={12} />
                    <span>{cite.guest_name} ({cite.episode_title.slice(0, 25)}...)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Copy Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
