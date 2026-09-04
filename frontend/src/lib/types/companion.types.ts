export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isError?: boolean;
}

export interface ChatResponse {
  message: string;
  facts_used?: string[];
  session_id?: string;
}
