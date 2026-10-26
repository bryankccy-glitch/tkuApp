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
  /** What the engine was asked, when it differs from the shown text (quick questions in other languages). */
  asked?: string;
  sources?: SourceRef[];
  error?: boolean;
  /** Which engine answered */
  engine?: 'local' | 'cloud';
}
