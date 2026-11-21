export type NusaModel = 'NUSA Assistant' | 'NUSA Creative' | 'NUSA Code';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  created_at: number;
}

export interface Conversation {
  id: string;
  title: string;
  model: NusaModel;
  created_at: number;
  updated_at: number;
  message_count?: number;
  last_message?: string;
}

export interface QARecord {
  id: string;
  conversation_id: string;
  question: string;
  answer: string;
  model: string;
  latency_ms: number;
  tokens: number;
  memory_context?: string;
  tags?: string;
  created_at: number;
  conversation_title?: string;
}

export interface MemoryFact {
  id: string;
  conversation_id: string;
  fact_key: string;
  fact_value: string;
  confidence: number;
  created_at: number;
  updated_at: number;
}

export interface SystemStats {
  total_conversations: number;
  total_messages: number;
  total_qa_pairs: number;
  avg_latency_ms: number;
  total_memory_facts: number;
  total_users?: number;
  database_file: string;
  status: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar_url?: string;
  status: 'active' | 'banned';
  created_at: number;
  last_login?: number;
}

export interface AdminStats extends SystemStats {
  admin_count: number;
  active_users: number;
  banned_users: number;
  recent_users: UserAccount[];
  system_config: Record<string, string>;
}

