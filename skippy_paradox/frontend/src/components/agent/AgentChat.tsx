import React, { useEffect, useRef } from 'react';
import { Loader2, Send, Sparkles, Square } from 'lucide-react';
import { marked } from 'marked';
import { StoredFile } from '../../services/storageService';
import { Message, QUICK_ACTIONS } from './geminiStore';
import { RoleRow, ToolRow, ToolStatus, btnSecondary, iconBtn } from './ui';

/* ── Configure marked ──────────────────────────────────────────────── */

marked.setOptions({
  gfm: true,
  breaks: true,
});

/* ── Markdown renderer ─────────────────────────────────────────────── */

export function RenderedMarkdown({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = React.useMemo(() => {
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content]);

  useEffect(() => {
    if (!containerRef.current) return;
    const pres = containerRef.current.querySelectorAll('pre');
    pres.forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;
      pre.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-ctl border border-line bg-bg-elevated hover:border-line-hover transition-colors text-fg-secondary hover:text-fg text-[11px]';
      btn.textContent = 'Copy';
      btn.onclick = () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent || '';
        navigator.clipboard.writeText(code);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      };
      pre.appendChild(btn);
    });

    const links = containerRef.current.querySelectorAll('a');
    links.forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="ai-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Message row (flat, no bubbles) ────────────────────────────────── */

const stepStatus = (status: 'running' | 'success' | 'failed'): ToolStatus =>
  status === 'running' ? 'running' : status === 'failed' ? 'error' : 'ok';

function MessageRow({ msg, isStreaming }: { msg: Message; isStreaming?: boolean }) {
  const isUser = msg.role === 'user';

  return (
    <RoleRow role={isUser ? 'You' : 'Shenron'} tone={isUser ? 'user' : 'default'}>
      {!isUser && msg.steps && msg.steps.length > 0 && (
        <div className="mb-2 space-y-1">
          {msg.steps.map((st) => (
            <ToolRow
              key={st.id}
              status={stepStatus(st.status)}
              name={st.title}
              meta={st.type === 'tool_call' ? 'tool' : st.type === 'tool_result' ? 'success' : 'done'}
              detail={st.details}
              defaultOpen={st.status === 'running'}
            />
          ))}
        </div>
      )}

      {msg.loading && !msg.content ? (
        <div className="flex items-center gap-2 text-[12px] text-fg-secondary">
          <Loader2 size={14} className="animate-spin" />
          <span>Agent inspecting files & executing tools...</span>
        </div>
      ) : isUser ? (
        <span className="whitespace-pre-wrap">{msg.content}</span>
      ) : (
        <>
          <RenderedMarkdown content={msg.content} />
          {isStreaming && (
            <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-blink-cursor bg-accent align-middle" />
          )}
        </>
      )}
    </RoleRow>
  );
}

/* ── Chat body: quick actions, messages, composer ──────────────────── */

interface AgentChatProps {
  activeFile: StoredFile | null;
  messages: Message[];
  streamingMsgId: string | null;
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: (prompt: string) => void;
  onStop: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function AgentChat({
  activeFile,
  messages,
  streamingMsgId,
  isLoading,
  input,
  onInputChange,
  onSubmit,
  onKeyDown,
  onSend,
  onStop,
  scrollContainerRef,
  messagesEndRef,
}: AgentChatProps) {
  return (
    <>
      {/* Quick actions — only when empty */}
      {messages.length === 0 && (
        <div className="shrink-0 border-b border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onSend(action.prompt)}
                disabled={isLoading || !activeFile}
                className={btnSecondary}
              >
                {action.label}
              </button>
            ))}
          </div>
          {!activeFile && (
            <p className="mt-1.5 text-[11px] text-fg-muted">Open a file to use quick actions</p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="scrollbar-hide h-full overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-fg-muted">
              <Sparkles size={16} className="mb-2 text-fg-secondary" />
              <p className="text-[12px] font-medium text-fg-secondary">Ask Shenron anything</p>
              <p className="mt-0.5 text-[11px]">Analyze, fix, or improve your code</p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              isStreaming={msg.loading && msg.id === streamingMsgId && msg.content.length > 0}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 space-y-2 border-t border-line p-3">
        {isLoading && (
          <button type="button" onClick={onStop} className={`${btnSecondary} w-full text-danger`}>
            <Square size={14} /> Stop generating
          </button>
        )}
        <form onSubmit={onSubmit} className="relative">
          <input
            type="text"
            aria-label="Ask Shenron"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={activeFile ? `Ask about ${activeFile.name}...` : 'Ask Shenron...'}
            className="h-8 w-full rounded-ctl border border-line bg-bg pl-2.5 pr-9 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-accent"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || isLoading}
            className={`${iconBtn} absolute right-0.5 top-1/2 -translate-y-1/2 enabled:text-accent`}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      </div>
    </>
  );
}
