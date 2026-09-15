import React from 'react';
import { marked } from 'marked';
import { Layout, Copy, Check, ExternalLink } from 'lucide-react';
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
          <div className="user-message-copy">{message.content}</div>
        ) : (
          <>
            <div className="assistant-label">Lenny Growth Assistant</div>
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: parsedMarkdown }} />

            {message.artifacts && message.artifacts.length > 0 && (
              <div className="artifact-stack">
                {message.artifacts.map((artifact, idx) => (
                  <button
                    key={artifact.id || idx}
                    type="button"
                    className="artifact-trigger-btn"
                    onClick={() => onOpenArtifact(artifact)}
                  >
                    <Layout size={16} />
                    <span>View generated artifact: {artifact.title}</span>
                  </button>
                ))}
              </div>
            )}

            {message.citations && message.citations.length > 0 && (
              <div className="citation-panel">
                <div className="citation-panel-header">These sources ground this answer.</div>
                <div className="citation-list">
                  {message.citations.map((cite, idx) => (
                    <button
                      type="button"
                      key={`${cite.episode_title}-${idx}`}
                      className="citation-item"
                      onClick={() => onOpenCitation(cite)}
                      title="Open source citation"
                    >
                      <div className="citation-number">{String(idx + 1).padStart(2, '0')}</div>
                      <div className="citation-body">
                        <div className="citation-guest">{cite.guest_name}</div>
                        <div className="citation-episode">{cite.episode_title}</div>
                        <div className="citation-excerpt">{cite.excerpt}</div>
                        <div className="citation-link">
                          <span>Open source</span>
                          <ExternalLink size={12} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="message-tools">
              <button type="button" className="copy-button" onClick={handleCopy}>
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
