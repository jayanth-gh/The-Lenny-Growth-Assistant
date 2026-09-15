import React, { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { X, Code, Eye, Copy, Download, Check, ShieldAlert } from 'lucide-react';
import { Artifact } from '../types';

interface ArtifactViewerProps {
  artifact: Artifact;
  onClose: () => void;
}

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, onClose }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const isHtml = artifact.type === 'html';

  // Security Sanitization & Sandboxing Strategy
  const sanitizedHtmlDoc = useMemo(() => {
    if (!isHtml) return '';
    const cleanContent = DOMPurify.sanitize(artifact.content, {
      ADD_TAGS: ['script'],
      ADD_ATTR: ['onclick', 'onchange', 'onsubmit', 'oninput'],
      FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'base', 'link'],
      FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onfocus', 'href', 'src', 'action', 'formaction'],
      ALLOW_DATA_ATTR: false
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none';">
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 20px; color: #111827; background: #ffffff; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${cleanContent}
        </body>
      </html>
    `;
  }, [artifact.content, isHtml]);

  const parsedMarkdownDoc = useMemo(() => {
    if (isHtml) return '';
    try {
      return DOMPurify.sanitize(marked.parse(artifact.content, { async: false }) as string, {
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'link'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'href', 'src', 'action', 'formaction'],
        ALLOW_DATA_ATTR: false
      });
    } catch {
      return artifact.content;
    }
  }, [artifact.content, isHtml]);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = isHtml ? 'html' : 'md';
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="artifact-drawer">
      {/* Header */}
      <div className="artifact-header">
        <div className="artifact-title">
          <span>{artifact.title}</span>
        </div>

        <div className="artifact-header-actions">
          <div className="artifact-tabs">
            <button
              className={`artifact-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              <Eye size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Preview
            </button>
            <button
              className={`artifact-tab ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              <Code size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Code
            </button>
          </div>

          <button className="icon-button" onClick={handleCopy} title="Copy Content">
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
          </button>

          <button className="icon-button" onClick={handleDownload} title="Download Artifact">
            <Download size={16} />
          </button>

          <button className="icon-button" onClick={onClose} title="Close Panel">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="artifact-security">
        <ShieldAlert size={13} />
        <span>Sandboxed isolated execution ({isHtml ? 'HTML/CSS iframe sandbox' : 'Markdown native viewer'})</span>
      </div>

      {/* Body View */}
      <div className="artifact-body">
        {activeTab === 'preview' ? (
          isHtml ? (
            <iframe
              title={artifact.title}
              className="artifact-iframe"
              sandbox="allow-scripts"
              srcDoc={sanitizedHtmlDoc}
            />
          ) : (
            <div
              className="article-document markdown-body"
              style={{ lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: parsedMarkdownDoc }}
            />
          )
        ) : (
          <pre className="code-view">
            <code>{artifact.content}</code>
          </pre>
        )}
      </div>
    </aside>
  );
};
