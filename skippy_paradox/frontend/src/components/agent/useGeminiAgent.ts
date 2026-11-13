import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StoredFile } from '../../services/storageService';
import { geminiKeyRotation } from '../../services/geminiKeyRotation';
import { runAgentLoop } from '../../services/agentService';
import {
  Conversation, GeminiProvider, Message,
  GEMINI_API_KEY_STORAGE, OPENROUTER_API_KEY_STORAGE, PROVIDER_STORAGE, MODEL_STORAGE, AGENT_MODE_STORAGE,
  MAX_HISTORY_MESSAGES, MAX_FILE_CONTEXT_CHARS, MAX_CONVERSATIONS,
  loadConversations, saveConversations, loadActiveConvId, saveActiveConvId, newId, createConversation,
} from './geminiStore';

export interface GeminiAgentOptions {
  activeFile: StoredFile | null;
  allFiles?: StoredFile[];
  onCodeChange?: (fileId: string, content: string) => void;
  onFileCreate?: () => void;
  onAgentFileCreate?: (name: string, content: string, language?: string) => void;
}

/**
 * State + behaviour for the Gemini/OpenRouter agent chat. Moved verbatim out of
 * GeminiPanel so the panel itself only composes the UI pieces.
 */
export function useGeminiAgent({
  activeFile,
  allFiles,
  onCodeChange,
  onFileCreate,
  onAgentFileCreate,
}: GeminiAgentOptions) {
  // Agent Harness & Provider state
  const [provider, setProvider] = useState<GeminiProvider>(() => {
    return 'openrouter';
  });
  const [model, setModel] = useState<string>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE);
    if (!saved || saved.toLowerCase().includes('claude') || saved.toLowerCase().includes('sonnet') || saved.toLowerCase().includes('gpt-4')) {
      localStorage.setItem(MODEL_STORAGE, 'nvidia/nemotron-3.5-lightning:free');
      return 'nvidia/nemotron-3.5-lightning:free';
    }
    return saved;
  });
  const [isAgentHarness, setIsAgentHarness] = useState<boolean>(() => {
    return localStorage.getItem(AGENT_MODE_STORAGE) !== 'false';
  });
  const [openRouterKey, setOpenRouterKey] = useState<string>(() => {
    const key = localStorage.getItem(OPENROUTER_API_KEY_STORAGE);
    const envKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
    if (key && key.startsWith('sk-or-')) return key;
    if (envKey) {
      localStorage.setItem(OPENROUTER_API_KEY_STORAGE, envKey);
      return envKey;
    }
    return '';
  });
  const [geminiCustomKey, setGeminiCustomKey] = useState<string>(() => {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  });
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    // Sanitize any stale or paid models if on OpenRouter
    const savedModel = localStorage.getItem(MODEL_STORAGE);
    if (!savedModel || savedModel.toLowerCase().includes('claude') || savedModel.toLowerCase().includes('sonnet') || savedModel.toLowerCase().includes('gpt-4')) {
      setModel('nvidia/nemotron-3.5-lightning:free');
      localStorage.setItem(MODEL_STORAGE, 'nvidia/nemotron-3.5-lightning:free');
    }
  }, []);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(loadActiveConvId);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyStats, setKeyStats] = useState(geminiKeyRotation.getUsageStats());

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingMsgId = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(PROVIDER_STORAGE, provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem(MODEL_STORAGE, model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem(AGENT_MODE_STORAGE, String(isAgentHarness));
  }, [isAgentHarness]);

  useEffect(() => {
    if (openRouterKey) localStorage.setItem(OPENROUTER_API_KEY_STORAGE, openRouterKey);
    else localStorage.removeItem(OPENROUTER_API_KEY_STORAGE);
  }, [openRouterKey]);

  useEffect(() => {
    if (geminiCustomKey) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, geminiCustomKey);
      geminiKeyRotation.setCustomKey(geminiCustomKey);
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
  }, [geminiCustomKey]);

  /* ── Initialize conversation ───────────────────────────────────── */

  useEffect(() => {
    const convs = loadConversations();
    setConversations(convs);

    let id = loadActiveConvId();
    if (id && convs.find((c) => c.id === id)) {
      setMessages(convs.find((c) => c.id === id)!.messages);
    } else {
      const conv = createConversation();
      const updated = [conv, ...convs].slice(0, MAX_CONVERSATIONS);
      saveConversations(updated);
      saveActiveConvId(conv.id);
      setConversations(updated);
      setActiveConvId(conv.id);
      id = conv.id;
    }
    setActiveConvId(id);
  }, []);

  /* ── Persist messages on change ────────────────────────────────── */

  const persistConversation = useCallback((msgs: Message[]) => {
    if (!activeConvId) return;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: msgs, updatedAt: Date.now() }
          : c
      );
      saveConversations(updated);
      return updated;
    });
  }, [activeConvId]);

  /* ── Auto-scroll ───────────────────────────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Block wheel ───────────────────────────────────────────────── */

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  /* ── Build Gemini request ──────────────────────────────────────── */

  const buildContext = useCallback(() => {
    if (!activeFile) return '';
    const lang = activeFile.language || 'plaintext';
    const full = activeFile.content || '';
    const content = full.length > MAX_FILE_CONTEXT_CHARS
      ? `${full.slice(0, MAX_FILE_CONTEXT_CHARS)}\n\n[Truncated]`
      : full;
    return `\`\`\`${lang}\n// File: ${activeFile.name}\n${content}\n\`\`\``;
  }, [activeFile]);

  const buildContents = useCallback((userText: string) => {
    const history = messages
      .filter((m) => !m.loading && m.content.trim())
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.content }],
      }));

    const context = buildContext();
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (context) {
      contents.push({
        role: 'user',
        parts: [{ text: `You are an expert coding assistant in Shenron. Use this file context when relevant:\n\n${context}` }],
      });
    }

    contents.push(...history);
    contents.push({ role: 'user', parts: [{ text: userText }] });
    return contents;
  }, [buildContext, messages]);

  /* ── Streaming send ────────────────────────────────────────────── */

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const effectiveKey = provider === 'openrouter'
      ? (openRouterKey || localStorage.getItem(OPENROUTER_API_KEY_STORAGE))
      : (localStorage.getItem(GEMINI_API_KEY_STORAGE) || geminiKeyRotation.getCurrentKey());

    if (!effectiveKey) {
      setShowConfigModal(true);
      const errMsg: Message = {
        id: newId(),
        role: 'assistant',
        content: provider === 'openrouter'
          ? '🔑 Please paste your OpenRouter API key in the configuration drawer above to start.'
          : '🔑 Please paste your Gemini API key in the configuration drawer above to start.',
        timestamp: Date.now(),
      };
      const next = [...messages, errMsg];
      setMessages(next);
      persistConversation(next);
      return;
    }

    const userMsg: Message = { id: newId(), role: 'user', content: userText, timestamp: Date.now() };
    const assistantMsg: Message = {
      id: newId(),
      role: 'assistant',
      content: '',
      loading: true,
      timestamp: Date.now(),
      steps: [],
    };

    streamingMsgId.current = assistantMsg.id;
    const withUserMsg = [...messages, userMsg, assistantMsg];
    setMessages(withUserMsg);
    setInput('');
    setIsLoading(true);

    if (activeConvId) {
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === activeConvId);
        if (conv && conv.name === 'New chat' && conv.messages.length === 0) {
          const name = userText.slice(0, 40) + (userText.length > 40 ? '...' : '');
          const updated = prev.map((c) => c.id === activeConvId ? { ...c, name } : c);
          saveConversations(updated);
          return updated;
        }
        return prev;
      });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // ── Autonomous Agent Harness Execution ──
    if (isAgentHarness) {
      try {
        const finalAnswer = await runAgentLoop({
          prompt: userText,
          apiKey: effectiveKey,
          provider,
          model,
          signal: controller.signal,
          currentFiles: allFiles,
          callbacks: {
            onStep: (step) => {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsg.id) return m;
                  const currentSteps = m.steps || [];
                  const existingIdx = currentSteps.findIndex((s) => s.id === step.id);
                  let newSteps = [...currentSteps];
                  if (existingIdx >= 0) {
                    newSteps[existingIdx] = step;
                  } else {
                    newSteps.push(step);
                  }
                  return { ...m, steps: newSteps };
                })
              );
            },
            onUpdateFile: (fileId, content) => {
              if (onCodeChange) onCodeChange(fileId, content);
            },
            onCreateFile: (name, content, language) => {
              if (onAgentFileCreate) {
                onAgentFileCreate(name, content, language);
              } else if (onFileCreate) {
                (onFileCreate as any)(name, content, language);
              }
            },
            onSaveFile: (file) => {
              if (onAgentFileCreate) {
                onAgentFileCreate(file.name, file.content, file.language);
              }
            },
          },
        });

        if (provider === 'gemini' && !localStorage.getItem(GEMINI_API_KEY_STORAGE)) {
          geminiKeyRotation.recordUsage();
          setKeyStats(geminiKeyRotation.getUsageStats());
        }

        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: finalAnswer, loading: false }
              : m
          );
          persistConversation(final);
          return final;
        });
      } catch (err: any) {
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Agent error: ${err.message}`, loading: false }
              : m
          );
          persistConversation(final);
          return final;
        });
      } finally {
        setIsLoading(false);
        streamingMsgId.current = null;
        abortRef.current = null;
      }
      return;
    }

    const requestContents = buildContents(userText);
    let accumulated = '';

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${effectiveKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: requestContents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              accumulated += text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: accumulated, loading: true } : m
                )
              );
            }
          } catch { /* skip malformed chunk */ }
        }
      }

      if (!localStorage.getItem(GEMINI_API_KEY_STORAGE)) {
        geminiKeyRotation.recordUsage();
        setKeyStats(geminiKeyRotation.getUsageStats());
      }

      setMessages((prev) => {
        const final = prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: accumulated || 'No response received.', loading: false }
            : m
        );
        persistConversation(final);
        return final;
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, loading: false } : m
          );
          persistConversation(final);
          return final;
        });
      } else {
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${e.message}`, loading: false }
              : m
          );
          persistConversation(final);
          return final;
        });
      }
    } finally {
      setIsLoading(false);
      streamingMsgId.current = null;
      abortRef.current = null;
    }
  }, [isLoading, messages, buildContents, persistConversation, activeConvId]);

  /* ── Stop streaming ────────────────────────────────────────────── */

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ── Conversation management ───────────────────────────────────── */

  const switchConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveConvId(id);
    saveActiveConvId(id);
    setMessages(conv.messages);
  }, [conversations]);

  const startNewConversation = useCallback(() => {
    const conv = createConversation();
    const updated = [conv, ...conversations].slice(0, MAX_CONVERSATIONS);
    saveConversations(updated);
    saveActiveConvId(conv.id);
    setConversations(updated);
    setActiveConvId(conv.id);
    setMessages([]);
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    saveConversations(updated);
    setConversations(updated);

    if (id === activeConvId) {
      if (updated.length > 0) {
        switchConversation(updated[0].id);
      } else {
        startNewConversation();
      }
    }
  }, [conversations, activeConvId, switchConversation, startNewConversation]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    persistConversation([]);
  }, [persistConversation]);

  /* ── Form handlers ─────────────────────────────────────────────── */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetKeyUsage = () => {
    geminiKeyRotation.resetUsage();
    setKeyStats(geminiKeyRotation.getUsageStats());
  };

  return {
    provider, setProvider,
    model, setModel,
    isAgentHarness, setIsAgentHarness,
    openRouterKey, setOpenRouterKey,
    geminiCustomKey, setGeminiCustomKey,
    showConfigModal, setShowConfigModal,
    conversations, activeConvId,
    messages,
    input, setInput,
    isLoading,
    keyStats, resetKeyUsage,
    messagesEndRef, scrollContainerRef, streamingMsgId,
    sendMessage, stopStreaming,
    switchConversation, startNewConversation, deleteConversation, clearMessages,
    handleSubmit, handleKeyDown,
  };
}
