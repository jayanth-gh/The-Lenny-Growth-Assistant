export interface Citation {
  episode_title: string;
  guest_name: string;
  episode_url: string;
  publish_date?: string;
  excerpt: string;
}

export interface Artifact {
  id: string;
  type: 'html' | 'markdown' | 'code';
  title: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  artifacts: Artifact[];
  model_used: string;
  skill_executed?: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  provider_config: {
    provider: string;
    model: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ModelProviderInfo {
  name: string;
  agent_layer?: string;
  status: string;
  available_models: string[];
  requires_api_key: boolean;
  is_configured?: boolean;
}

export interface ModelsResponse {
  active_default: {
    provider: string;
    model: string;
  };
  providers: {
    ollama: ModelProviderInfo;
    anthropic: ModelProviderInfo;
    openai: ModelProviderInfo;
  };
}

export interface TranscriptSearchResult {
  episode_title: string;
  guest_name: string;
  episode_url: string;
  publish_date: string;
  content: string;
  score: number;
}
