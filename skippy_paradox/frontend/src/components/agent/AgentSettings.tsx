import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, RotateCcw, X } from 'lucide-react';
import { Conversation, GeminiProvider, NEMOTRON_PRESETS } from './geminiStore';
import { btnGhost, btnPrimary, fieldCls, iconBtn, labelCls } from './ui';

/* ── Settings drawer ───────────────────────────────────────────────── */

interface AgentSettingsProps {
  provider: GeminiProvider;
  model: string;
  onModelChange: (model: string) => void;
  openRouterKey: string;
  onOpenRouterKeyChange: (key: string) => void;
  geminiCustomKey: string;
  onGeminiCustomKeyChange: (key: string) => void;
  onClose: () => void;
}

export function AgentSettings({
  provider,
  model,
  onModelChange,
  openRouterKey,
  onOpenRouterKeyChange,
  geminiCustomKey,
  onGeminiCustomKeyChange,
  onClose,
}: AgentSettingsProps) {
  return (
    <div className="space-y-2 rounded-ctl border border-line bg-bg-elevated p-3">
      <div className={labelCls}>Agent configuration</div>

      {provider === 'openrouter' && (
        <div className="space-y-2">
          <input
            type="password"
            aria-label="OpenRouter API key"
            placeholder="Paste OpenRouter API Key"
            value={openRouterKey}
            onChange={(e) => onOpenRouterKeyChange(e.target.value)}
            className={fieldCls}
          />
          <input
            type="text"
            aria-label="Model name"
            placeholder="Model name"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className={`${fieldCls} font-mono text-[11px]`}
          />
          <div className="flex flex-wrap gap-1">
            {NEMOTRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onModelChange(preset.value)}
                className={`h-6 rounded-ctl border px-2 text-[11px] transition-colors ${
                  model === preset.value
                    ? 'border-accent text-accent'
                    : 'border-line text-fg-secondary hover:border-line-hover hover:text-fg'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {provider === 'gemini' && (
        <div className="space-y-2">
          <input
            type="password"
            aria-label="Gemini API key"
            placeholder="Paste Gemini API Key (Pro account key)"
            value={geminiCustomKey}
            onChange={(e) => onGeminiCustomKeyChange(e.target.value)}
            className={fieldCls}
          />
          <select
            aria-label="Gemini model"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className={fieldCls}
          >
            <option value="gemini-2.0-flash">gemini-2.0-flash (Fast & Accurate)</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning)</option>
            <option value="gemini-2.5-pro-exp">gemini-2.5-pro-exp (Top Coding)</option>
          </select>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnPrimary}>Done</button>
      </div>
    </div>
  );
}

/* ── Gemini key-rotation usage ─────────────────────────────────────── */

export function KeyStats({
  stats,
  onReset,
}: {
  stats: Array<{ keyIndex: number; usage: number; isCurrent: boolean }>;
  onReset: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {stats.map((stat) => (
        <span
          key={stat.keyIndex}
          className={`rounded px-1 font-mono text-[10px] ${stat.isCurrent ? 'bg-white/5 text-fg' : 'text-fg-muted'}`}
        >
          K{stat.keyIndex}:{stat.usage}
        </span>
      ))}
      <button type="button" onClick={onReset} className={iconBtn} title="Reset key usage" aria-label="Reset key usage">
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

/* ── Conversation history menu ─────────────────────────────────────── */

export function ConversationMenu({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`${btnGhost} px-1.5`}
      >
        <span>History</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-ctl border border-line bg-bg-elevated shadow-subtle">
          <button
            type="button"
            onClick={() => { onNew(); setOpen(false); }}
            className="flex h-8 w-full items-center gap-2 px-3 text-[12px] font-medium text-fg hover:bg-white/5"
          >
            <Plus size={14} className="text-fg-secondary" /> New chat
          </button>

          <div className="border-t border-line" />

          <div className="custom-scrollbar max-h-56 overflow-y-auto py-1">
            {sorted.length === 0 && (
              <div className="px-3 py-3 text-center text-[12px] text-fg-muted">No conversations yet</div>
            )}
            {sorted.map((conv) => (
              <div
                key={conv.id}
                className={`group flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors ${
                  conv.id === activeId ? 'bg-white/5' : 'hover:bg-white/5'
                }`}
                onClick={() => { onSelect(conv.id); setOpen(false); }}
              >
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[12px] ${conv.id === activeId ? 'font-medium text-fg' : 'text-fg-secondary'}`}>
                    {conv.name}
                  </div>
                  <div className="text-[11px] text-fg-muted">
                    {conv.messages.length} msgs · {relativeTime(conv.updatedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${conv.name}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  className="rounded p-0.5 text-fg-muted opacity-0 transition-all hover:bg-white/5 hover:text-danger group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
