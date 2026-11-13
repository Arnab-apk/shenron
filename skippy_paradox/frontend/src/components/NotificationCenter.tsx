/**
 * NotificationCenter — Advanced notification system with grouping and actions.
 * Manages all app notifications in one place.
 */

import React, { useState } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onDismiss,
  onMarkAsRead,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={14} className="shrink-0 text-success" />;
      case 'error': return <AlertCircle size={14} className="shrink-0 text-danger" />;
      case 'warning': return <AlertTriangle size={14} className="shrink-0 text-amber-400" />;
      default: return <Info size={14} className="shrink-0 text-fg-secondary" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative font-sans">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative h-7 w-7 flex items-center justify-center rounded-ctl text-fg-secondary hover:bg-white/5 hover:text-fg transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent/70 ${
          isOpen ? 'bg-white/5 text-fg' : ''
        }`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-accent text-[#0A0A0F] text-[9px] font-semibold leading-[14px] text-center tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute right-0 top-9 w-[360px] max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-bg-elevated shadow-[0_12px_32px_rgba(0,0,0,0.45)] z-50 overflow-hidden animate-fade-in"
            style={{ animationDuration: '120ms' }}
          >
            {/* Header */}
            <div className="flex items-center h-10 px-3 border-b border-line">
              <h3 className="text-[13px] font-medium text-fg">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="ml-2 text-[11px] text-fg-muted tabular-nums">{unreadCount} unread</span>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="ml-auto h-6 px-2 rounded-ctl text-[12px] text-fg-secondary hover:bg-white/5 hover:text-fg transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-fg-muted">
                  <Bell size={16} />
                  <p className="text-[12px]">No notifications</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`group relative flex gap-2.5 pl-4 pr-2 py-2.5 border-b border-line last:border-b-0 transition-colors hover:bg-white/[0.03] ${
                      notif.read ? '' : 'bg-white/[0.02]'
                    }`}
                    onClick={() => !notif.read && onMarkAsRead(notif.id)}
                  >
                    {!notif.read && (
                      <span className="absolute left-1.5 top-[15px] w-1.5 h-1.5 rounded-full bg-accent" aria-label="Unread" role="img" />
                    )}
                    <div className="mt-px">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <h4 className={`flex-1 min-w-0 truncate text-[13px] leading-4 ${notif.read ? 'text-fg-secondary' : 'text-fg font-medium'}`}>
                          {notif.title}
                        </h4>
                        <span className="shrink-0 text-[11px] leading-4 text-fg-muted tabular-nums">
                          {formatTime(notif.timestamp)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(notif.id);
                          }}
                          className="shrink-0 -mt-0.5 h-5 w-5 flex items-center justify-center rounded-[4px] text-fg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 hover:text-fg transition-opacity"
                          aria-label={`Dismiss ${notif.title}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="mt-1 text-[12px] leading-[18px] text-fg-secondary">
                        {notif.message}
                      </p>
                      {notif.action && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            notif.action!.onClick();
                          }}
                          className="mt-2 h-6 px-2 rounded-ctl border border-line bg-bg text-[12px] font-medium text-fg hover:border-line-hover transition-colors"
                        >
                          {notif.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
