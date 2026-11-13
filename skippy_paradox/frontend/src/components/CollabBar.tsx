/**
 * CollabBar — Status bar displayed when a collab room is active.
 *
 * Shows: room ID, connection status, member avatars, pending join requests (host only),
 * and a leave button.
 */

import React, { useState } from 'react';
import { useMountTransition } from '../hooks/useMountTransition';
import {
  Users, WifiOff, Loader2, Copy, Check, LogOut,
  UserCheck, UserX, Clock, Crown, X,
} from 'lucide-react';
import { CollabMember, PendingRequest, CollabStatus } from '../services/collabService';
import { CollabToast } from '../hooks/useCollabRoom';

interface Props {
  roomId: string;
  status: CollabStatus;
  isHost: boolean;
  members: CollabMember[];
  pending: PendingRequest[];
  toasts: CollabToast[];
  onApprove: (peerId: string) => void;
  onReject: (peerId: string) => void;
  onLeave: () => void;
  onDismissToast: (id: string) => void;
}

export const CollabBar: React.FC<Props> = ({
  roomId, status, isHost, members, pending,
  onApprove, onReject, onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const { hasRendered, isActive } = useMountTransition(showPanel, 300);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusIcon = () => {
    switch (status) {
      case 'connected': return <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />;
      case 'connecting':
      case 'waiting-approval': return <Loader2 size={12} className="animate-spin text-fg-secondary" />;
      default: return <WifiOff size={12} className="text-danger" />;
    }
  };

  const statusLabel = () => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting…';
      case 'waiting-approval': return 'Waiting for approval…';
      case 'rejected': return 'Rejected';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  const iconBtn = 'inline-flex items-center justify-center w-6 h-6 rounded-ctl transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent';

  return (
    <div className="relative shrink-0 font-sans">
      {/* ── Collab room bar ───────────────────────────────────────────── */}
      <div className="h-7 flex items-center justify-between px-2 bg-bg-panel border-t border-line text-[11px] text-fg-secondary">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            {statusIcon()}
            <span>{statusLabel()}</span>
          </div>

          <span className="w-px h-3 bg-line" aria-hidden="true" />

          {/* Room ID (innerText must stay the bare room id) */}
          <button onClick={handleCopy}
            className="flex items-center gap-1.5 h-5 px-1.5 rounded-ctl font-mono tracking-wider text-fg hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            title="Copy Room ID">
            <span>{roomId}</span>
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} className="text-fg-muted" />}
          </button>

          {isHost && (
            <span className="flex items-center gap-1 text-fg-muted">
              <Crown size={12} /> Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Member avatars */}
          <button
            onClick={() => setShowPanel(!showPanel)}
            aria-expanded={showPanel}
            className="relative flex items-center gap-1.5 h-6 px-1.5 rounded-ctl hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <div className="flex -space-x-1">
              {members.slice(0, 5).map(m => (
                <div
                  key={m.peerId}
                  className="w-4 h-4 rounded-full ring-1 ring-[#111118] flex items-center justify-center text-[9px] font-semibold text-[#0A0A0F]"
                  style={{ backgroundColor: m.color }}
                  title={m.displayName}
                >
                  {m.displayName[0]?.toUpperCase()}
                </div>
              ))}
              {members.length > 5 && (
                <div className="w-4 h-4 rounded-full ring-1 ring-[#111118] bg-bg-elevated flex items-center justify-center text-[9px] text-fg-secondary">
                  +{members.length - 5}
                </div>
              )}
            </div>
            <Users size={12} />
            <span>{members.length}</span>

            {isHost && pending.length > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[#0A0A0F] text-[10px] leading-4 font-semibold text-center">
                {pending.length}
              </span>
            )}
          </button>

          <button
            onClick={onLeave}
            className="flex items-center gap-1 h-6 px-2 rounded-ctl text-fg-secondary hover:text-danger hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <LogOut size={12} /> Leave
          </button>
        </div>
      </div>

      {/* ── Members / pending popover ─────────────────────────────────── */}
      {hasRendered && (
        <>
          <div className={`fixed inset-0 z-40 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-0'}`} onClick={() => setShowPanel(false)} />
          <div className={`absolute bottom-full right-2 mb-1 z-50 w-72 rounded-panel bg-bg-elevated border border-line shadow-subtle overflow-hidden transition-all duration-150 ease-out origin-bottom-right ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
            <div className="flex items-center justify-between h-9 pl-3 pr-1.5 border-b border-line">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">Room members</h3>
              <button onClick={() => setShowPanel(false)} aria-label="Close members panel" className={`${iconBtn} text-fg-secondary hover:text-fg hover:bg-white/5`}>
                <X size={14} />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
              {members.map(m => (
                <div key={m.peerId} className="flex items-center gap-2.5 px-3 h-8 hover:bg-white/[0.03]">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-[#0A0A0F] shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.displayName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-1 text-[12px] text-fg truncate">
                    {m.displayName}
                    {m.isHost && <Crown size={11} className="shrink-0 text-fg-muted" />}
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" aria-label="Online" />
                </div>
              ))}

              {isHost && pending.length > 0 && (
                <>
                  <div className="flex items-center gap-1 px-3 pt-2 pb-1 mt-1 border-t border-line text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                    <Clock size={11} /> Pending requests
                  </div>
                  {pending.map(p => (
                    <div key={p.peerId} className="flex items-center gap-2.5 px-3 h-9">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-[#0A0A0F] shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.displayName[0]?.toUpperCase()}
                      </div>
                      <span className="flex-1 text-[12px] text-fg truncate">{p.displayName}</span>
                      <div className="flex gap-0.5 shrink-0">
                        <button
                          onClick={() => onApprove(p.peerId)}
                          className={`${iconBtn} text-success hover:bg-white/5`}
                          title="Approve"
                        >
                          <UserCheck size={14} />
                        </button>
                        <button
                          onClick={() => onReject(p.peerId)}
                          className={`${iconBtn} text-danger hover:bg-white/5`}
                          title="Reject"
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
