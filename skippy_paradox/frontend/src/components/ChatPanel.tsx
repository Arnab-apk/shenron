import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, X } from 'lucide-react';
import { ChatMessage } from '../services/collabService';

interface ChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  selfPeerId: string;
  onSendMessage: (text: string) => void;
  canSend?: boolean;
  onClose?: () => void;
}

const MAX_MESSAGE_LENGTH = 1200;

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  messages,
  selfPeerId,
  onSendMessage,
  canSend = true,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  useEffect(() => {
    if (isOpen && canSend) inputRef.current?.focus();
  }, [isOpen, canSend]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const value = inputValue.trim();
    if (!value) return;
    onSendMessage(value);
    setInputValue('');
  };

  const remaining = MAX_MESSAGE_LENGTH - inputValue.length;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg-panel font-sans text-fg">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-fg-secondary" />
          <span className="text-[13px] font-semibold text-fg">Room Chat</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
            className="inline-flex h-7 w-7 items-center justify-center rounded-ctl text-fg-secondary transition-colors hover:bg-white/5 hover:text-fg"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="scrollbar-hide h-full overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-fg-muted">
              <MessageSquare size={16} className="mb-2 text-fg-secondary" />
              <p className="text-[12px] font-medium text-fg-secondary">No messages yet</p>
              <p className="mt-0.5 text-[11px]">Say hello to your collaborators!</p>
            </div>
          )}

          {messages.map((msg) => {
            const isSelf = msg.peerId === selfPeerId;
            return (
              <div key={msg.id} className="border-b border-line px-3 py-2 last:border-b-0">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: msg.color }} />
                  <span className={`text-[11px] font-medium ${isSelf ? 'text-fg' : 'text-fg-secondary'}`}>
                    {isSelf ? 'You' : msg.displayName}
                  </span>
                  <span className="text-[11px] text-fg-muted">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg">{msg.text}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-line p-3">
        <form onSubmit={handleSend} className="relative">
          <input
            ref={inputRef}
            type="text"
            aria-label="Chat message"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder={canSend ? 'Type a message...' : 'Join a room to chat'}
            disabled={!canSend}
            maxLength={MAX_MESSAGE_LENGTH}
            className="h-8 w-full rounded-ctl border border-line bg-bg pl-2.5 pr-9 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!canSend || !inputValue.trim()}
            className="absolute right-0.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-ctl text-fg-secondary transition-colors enabled:text-accent enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </form>
        <div className="mt-1 flex items-center justify-between text-[11px] text-fg-muted">
          <span>{canSend ? 'Enter to send' : ''}</span>
          {remaining < 100 && <span className={remaining < 40 ? 'text-danger' : ''}>{remaining}</span>}
        </div>
      </div>
    </div>
  );
};
