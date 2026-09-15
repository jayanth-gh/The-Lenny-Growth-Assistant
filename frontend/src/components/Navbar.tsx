import React from 'react';
import { Cpu, Search, Sparkles, Server, MoonStar, SunMedium } from 'lucide-react';
import { ModelsResponse } from '../types';

interface NavbarProps {
  currentProvider: string;
  currentModel: string;
  onProviderChange: (provider: string, model: string) => void;
  modelsData: ModelsResponse | null;
  onOpenSearch: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProvider,
  currentModel,
  onProviderChange,
  modelsData,
  onOpenSearch,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="navbar">
      <div className="brand">
        <Sparkles size={20} className="brand-icon" />
        <span>Lenny Growth Assistant</span>
      </div>

      <div className="nav-actions">
        <button className="theme-toggle" onClick={onToggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
          {theme === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>

        <button className="skill-pill" onClick={onOpenSearch} title="Search Podcast Transcripts Knowledge Base">
          <Search size={14} />
          <span>Search transcripts</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 10px', borderRadius: '999px', border: '1px solid var(--border-subtle)' }}>
          <Cpu size={14} color="#f97316" />
          <select
            value={`${currentProvider}:${currentModel}`}
            onChange={(e) => {
              const [p, m] = e.target.value.split(':');
              onProviderChange(p, m);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ollama:llama3.2">Ollama · Llama 3.2</option>
            <option value="anthropic:claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="openai:gpt-4o">OpenAI GPT-4o</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', background: '#f0fdf4', padding: '6px 10px', borderRadius: '999px', border: '1px solid rgba(16, 185, 129, 0.14)' }}>
          <Server size={12} color="#16a34a" />
          <span>System ready</span>
        </div>
      </div>
    </header>
  );
};
