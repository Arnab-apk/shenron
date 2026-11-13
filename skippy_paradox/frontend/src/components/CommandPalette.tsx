/**
 * CommandPalette — Linear-style command palette for power users.
 * Quick access to all actions with fuzzy search.
 */

import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { Search } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px] border border-line bg-bg text-[10px] font-sans font-medium text-fg-muted leading-none">
    {children}
  </kbd>
);

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Fuzzy search
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return labelMatch || keywordMatch;
    });
  }, [query, commands]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Keep the active row in view while navigating with the keyboard
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  const activeId = filteredCommands[selectedIndex] ? `${listId}-${selectedIndex}` : undefined;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh] px-4 font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        style={{ animationDuration: '120ms' }}
        onClick={onClose}
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-[560px] rounded-panel border border-line bg-bg-elevated shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in-up"
        style={{ animationDuration: '140ms' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2.5 h-12 px-4 border-b border-line">
          <Search size={16} className="shrink-0 text-fg-muted" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search commands"
            className="flex-1 min-w-0 bg-transparent text-[14px] text-fg placeholder:text-fg-muted outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        {/* Commands List */}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Commands"
          className="max-h-[360px] overflow-y-auto custom-scrollbar p-1"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-fg-muted">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const isActive = index === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={-1}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseMove={() => { if (!isActive) setSelectedIndex(index); }}
                  className={`relative w-full h-9 flex items-center gap-3 px-3 rounded-ctl text-left outline-none ${
                    isActive ? 'bg-white/5 text-fg' : 'text-fg-secondary'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden />
                  )}
                  <span className={`shrink-0 flex items-center justify-center w-4 h-4 [&>svg]:w-4 [&>svg]:h-4 ${
                    isActive ? 'text-fg' : 'text-fg-secondary'
                  }`}>
                    {cmd.icon}
                  </span>
                  <span className="flex-1 truncate text-[13px]">
                    {cmd.label}
                  </span>
                  {cmd.shortcut && (
                    <span className="shrink-0 text-[11px] text-fg-muted tracking-wide">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 h-8 px-4 border-t border-line text-[11px] text-fg-muted">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> Select
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd><Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
