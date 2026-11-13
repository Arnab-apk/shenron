import type { AgentStep } from '../../services/agentService';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
  timestamp: number;
  steps?: AgentStep[];
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type GeminiProvider = 'gemini' | 'openrouter';

/* ── Constants ─────────────────────────────────────────────────────── */

export const GEMINI_API_KEY_STORAGE = 'gemini-api-key';
export const OPENROUTER_API_KEY_STORAGE = 'openrouter-api-key';
export const PROVIDER_STORAGE = 'agent-provider-choice';
export const MODEL_STORAGE = 'agent-model-choice';
export const AGENT_MODE_STORAGE = 'agent-autonomous-mode';
export const CONVERSATIONS_STORAGE = 'gemini-conversations';
export const ACTIVE_CONV_STORAGE = 'gemini-active-conv';
export const MAX_HISTORY_MESSAGES = 10;
export const MAX_FILE_CONTEXT_CHARS = 12000;
export const MAX_CONVERSATIONS = 20;

export const QUICK_ACTIONS = [
  { label: 'Fix bugs', prompt: 'Inspect all workspace files, find and fix bugs, and execute to verify.' },
  { label: 'Add unit tests', prompt: 'Create unit tests for the current code in a new file and execute them.' },
  { label: 'Optimize', prompt: 'Analyze performance, refactor for efficiency, and test the output.' },
  { label: 'Agent plan', prompt: 'List all files, summarize current architecture, and plan next features.' },
];

export const OPENROUTER_MODELS = [
  { value: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning (Free)' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
  { value: 'qwen/qwen-2.5-coder-32b-instruct:free', label: 'Qwen 2.5 Coder (Free)' },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash Exp (Free)' },
  { value: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (Free)' },
];

export const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-2.5-pro-exp', label: 'Gemini 2.5 Pro Exp' },
];

export const NEMOTRON_PRESETS = [
  { value: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning (Free)' },
  { value: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra (Free)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super (Free)' },
];

/* ── Conversation persistence ──────────────────────────────────────── */

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE, JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)));
  } catch { /* quota exceeded — silently fail */ }
}

export function loadActiveConvId(): string | null {
  return localStorage.getItem(ACTIVE_CONV_STORAGE);
}

export function saveActiveConvId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_CONV_STORAGE, id);
  else localStorage.removeItem(ACTIVE_CONV_STORAGE);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversation(): Conversation {
  return {
    id: newId(),
    name: 'New chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
