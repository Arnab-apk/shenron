import React, { useState } from 'react';
import { Bot, CheckCircle2, ChevronRight, Loader2, XCircle } from 'lucide-react';

/* ── Shared class strings (Shenron design tokens) ──────────────────── */

export const fieldCls =
  'w-full h-8 rounded-ctl border border-line bg-bg px-2 text-[12px] text-fg placeholder:text-fg-muted outline-none focus:border-accent disabled:opacity-50';

export const selectCls =
  'h-7 min-w-0 rounded-ctl border border-line bg-bg px-1.5 text-[12px] text-fg outline-none cursor-pointer hover:border-line-hover focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed';

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-ctl bg-accent text-[#0A0A0F] text-[12px] font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-ctl border border-line bg-bg-elevated text-fg text-[12px] font-medium hover:border-line-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-ctl text-fg-secondary text-[12px] font-medium hover:bg-white/5 hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const iconBtn =
  'inline-flex items-center justify-center h-7 w-7 rounded-ctl text-fg-secondary hover:bg-white/5 hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-fg-muted';

/* ── Panel header ──────────────────────────────────────────────────── */

export function AgentHeader({ subtitle, children }: { subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Bot size={16} className="shrink-0 text-fg-secondary" />
        <span className="truncate text-[13px] font-semibold text-fg">Shenron Agent</span>
        {subtitle && <span className="truncate text-[11px] text-fg-muted">{subtitle}</span>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-0.5">{children}</div>}
    </header>
  );
}

/* ── Flat message row ──────────────────────────────────────────────── */

export function RoleRow({
  role,
  tone = 'default',
  children,
}: {
  role: React.ReactNode;
  tone?: 'default' | 'user' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line px-3 py-2.5 last:border-b-0">
      <div
        className={`mb-1 text-[11px] font-medium ${
          tone === 'user' ? 'text-fg-secondary' : tone === 'error' ? 'text-danger' : 'text-accent'
        }`}
      >
        {role}
      </div>
      <div className={`text-[13px] leading-relaxed ${tone === 'error' ? 'text-danger' : 'text-fg'}`}>{children}</div>
    </div>
  );
}

/* ── Tool-call row ─────────────────────────────────────────────────── */

export type ToolStatus = 'running' | 'ok' | 'error';

export function StatusIcon({ status }: { status: ToolStatus }) {
  if (status === 'running') return <Loader2 size={14} className="shrink-0 animate-spin text-fg-secondary" aria-label="Running" />;
  if (status === 'error') return <XCircle size={14} className="shrink-0 text-danger" aria-label="Failed" />;
  return <CheckCircle2 size={14} className="shrink-0 text-success" aria-label="Done" />;
}

export function ToolRow({
  status,
  name,
  meta,
  detail,
  defaultOpen,
}: {
  status: ToolStatus;
  name: React.ReactNode;
  meta?: React.ReactNode;
  detail?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean | undefined>(undefined);
  const isOpen = open ?? !!defaultOpen;
  const expandable = detail !== undefined && detail !== null && detail !== '';
  return (
    <div className="rounded-ctl border border-line bg-bg-elevated">
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? isOpen : undefined}
        onClick={() => setOpen(!isOpen)}
        className="flex h-7 w-full min-w-0 items-center gap-2 px-2 text-left text-[12px] text-fg enabled:hover:bg-white/5 disabled:cursor-default"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 text-fg-muted transition-transform ${isOpen ? 'rotate-90' : ''} ${expandable ? '' : 'opacity-0'}`}
        />
        <StatusIcon status={status} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{name}</span>
        {meta && <span className="shrink-0 text-[11px] text-fg-muted">{meta}</span>}
      </button>
      {expandable && isOpen && (
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all border-t border-line px-2 py-1.5 font-mono text-[11px] text-fg-secondary">
          {detail}
        </pre>
      )}
    </div>
  );
}
