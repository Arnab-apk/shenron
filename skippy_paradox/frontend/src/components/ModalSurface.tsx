/**
 * ModalSurface — shared dialog shell for Shenron modals.
 *
 * Overlay (black/60) + centered flat panel using design tokens.
 * Slots: title row (icon, title, subtitle, actions, close button), optional
 * toolbar (e.g. tabs) under the title, scrollable body, footer with an
 * optional left-aligned status and right-aligned buttons.
 *
 * role="dialog" + aria-modal, labelled by the title. Escape and backdrop
 * click call onClose. Mount/unmount uses a short fade.
 */

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useMountTransition } from '../hooks/useMountTransition';

export interface ModalSurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Small icon shown before the title (lucide, 16px). */
  icon?: React.ReactNode;
  /** One-line description under the title. */
  subtitle?: React.ReactNode;
  /** Extra content placed in the title row before the close button. */
  headerActions?: React.ReactNode;
  /** Non-scrolling row under the title (tabs, filters). */
  toolbar?: React.ReactNode;
  /** Right-aligned footer buttons. */
  footer?: React.ReactNode;
  /** Left-aligned footer content (status text). */
  footerStart?: React.ReactNode;
  children: React.ReactNode;
  /** Panel width in px. Defaults to 480. */
  width?: number;
  /** Extra classes for the scrollable body (default padding p-3). */
  bodyClassName?: string;
  /** Accessible name for the close button. */
  closeLabel?: string;
  /** Accessible name override when the title isn't plain text. */
  ariaLabel?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export const ModalSurface: React.FC<ModalSurfaceProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  subtitle,
  headerActions,
  toolbar,
  footer,
  footerStart,
  children,
  width = 480,
  bodyClassName = 'p-3',
  closeLabel = 'Close dialog',
  ariaLabel,
  closeOnEscape = true,
  closeOnBackdrop = true,
}) => {
  const { hasRendered, isActive } = useMountTransition(isOpen, 150);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, closeOnEscape]);

  // Remember what had focus before opening; restore it on close
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [isOpen]);

  // Move focus into the dialog once mounted (unless a child already took it, e.g. autoFocus)
  useEffect(() => {
    if (!isOpen || !hasRendered) return;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
  }, [isOpen, hasRendered]);

  if (!hasRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-150 ease-out ${
        isActive ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={e => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        style={{ width }}
        className={`flex max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-panel border border-line bg-bg-panel font-sans text-fg shadow-subtle outline-none transition-transform duration-150 ease-out ${
          isActive ? 'translate-y-0' : 'translate-y-1'
        }`}
      >
        {/* Title row */}
        <div className="flex shrink-0 items-start gap-2 border-b border-line px-3 py-2.5">
          {icon && <span className="mt-px flex h-5 shrink-0 items-center text-fg-secondary">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="flex items-center gap-2 text-[13px] font-semibold leading-5 text-fg">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12px] leading-4 text-fg-muted">{subtitle}</p>}
          </div>
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-ctl text-fg-secondary transition-colors hover:bg-white/5 hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <X size={14} />
          </button>
        </div>

        {toolbar && <div className="shrink-0 border-b border-line">{toolbar}</div>}

        {/* Body */}
        <div className={`min-h-0 flex-1 overflow-y-auto custom-scrollbar ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {(footer || footerStart) && (
          <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5">
            <div className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">{footerStart}</div>
            <div className="flex shrink-0 items-center gap-2">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
};

/* Shared control classes so modals stay consistent. */
export const modalStyles = {
  label: 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-muted',
  input:
    'h-8 w-full rounded-ctl border border-line bg-bg px-2.5 text-[12px] text-fg placeholder:text-fg-muted outline-none transition-colors focus:border-accent',
  btnPrimary:
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-ctl bg-accent px-3 text-[12px] font-medium text-[#0A0A0F] transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56C0F2]/50',
  btnSecondary:
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-ctl border border-line bg-bg-elevated px-3 text-[12px] font-medium text-fg transition-colors hover:border-line-hover disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
  btnGhost:
    'inline-flex h-7 items-center justify-center gap-1.5 rounded-ctl px-2 text-[12px] font-medium text-fg-secondary transition-colors hover:bg-white/5 hover:text-fg disabled:pointer-events-none disabled:opacity-40',
  tab: (active: boolean) =>
    `relative inline-flex h-9 items-center gap-1.5 px-3 text-[12px] font-medium transition-colors ${
      active
        ? 'text-fg after:absolute after:inset-x-3 after:bottom-[-1px] after:h-px after:bg-accent'
        : 'text-fg-secondary hover:text-fg'
    }`,
  // Token colors are CSS vars (no alpha channel), so tints use the hex values.
  error: 'flex items-start gap-2 rounded-ctl border border-[#F26B6B]/30 bg-[#F26B6B]/10 px-2.5 py-2 text-[12px] text-danger',
  success: 'flex items-start gap-2 rounded-ctl border border-[#4ADE80]/30 bg-[#4ADE80]/10 px-2.5 py-2 text-[12px] text-success',
};

export default ModalSurface;
