export interface SourceRef {
  title: string;
  publisher?: string;
  url?: string;
  updated?: string;
  /** 'personal' = the user's own data (課表/待辦) */
  kind: 'official' | 'personal' | 'campus';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRef[];
  error?: boolean;
  /** Which engine answered */
  engine?: 'local' | 'cloud';
}
