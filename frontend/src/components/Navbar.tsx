import React from 'react';
import { Cpu, Search, MoonStar, SunMedium } from 'lucide-react';
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
  onOpenSearch,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="navbar">
      <div className="navbar-brand" aria-label="Lenny Growth Assistant">
        <div className="brand-mark navbar-mark">
          <span className="brand-monogram">L</span>
        </div>
        <span className="navbar-brand-label">Lenny Growth Assistant</span>
      </div>

      <div className="nav-actions">
        <button className="nav-button nav-button-muted" onClick={onOpenSearch} title="Search podcast transcripts">
          <Search size={14} />
          <span>Search</span>
        </button>

        <div className="nav-select-shell">
          <Cpu size={14} />
          <select
            value={`${currentProvider}:${currentModel}`}
            onChange={e => {
              const [p, m] = e.target.value.split(':');
              onProviderChange(p, m);
            }}
          >
            <option value="ollama:llama3.2">Ollama • Llama 3.2</option>
            <option value="anthropic:claude-3-5-sonnet-20241022">Anthropic • Claude 3.5</option>
            <option value="openai:gpt-4o">OpenAI • GPT-4o</option>
          </select>
        </div>

        <div className="nav-status" aria-live="polite">
          <span className="status-dot" />
          <span>Ready</span>
        </div>

        <button className="theme-toggle" onClick={onToggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
          {theme === 'light' ? <MoonStar size={14} /> : <SunMedium size={14} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
};
