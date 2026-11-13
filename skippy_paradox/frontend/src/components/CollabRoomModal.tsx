/**
 * CollabRoomModal — UI for creating or joining a collaborative room.
 *
 * Two tabs:
 *   • Create Room: enter display name → generates a room ID → host mode
 *   • Join Room: enter room ID + display name → sends join request
 */

import React, { useState, useEffect } from 'react';
import { Users, Plus, LogIn, Copy, Check, AlertCircle } from 'lucide-react';
import { ModalSurface, modalStyles as ms } from './ModalSurface';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (displayName: string, roomId: string) => void;
  onJoinRoom: (displayName: string, roomId: string) => void;
  joinError?: string | null;
  onClearJoinError?: () => void;
  /** Tab to show when the modal opens. Omit to keep the last-used tab (default 'create'). */
  initialTab?: 'create' | 'join';
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export const CollabRoomModal: React.FC<Props> = ({ isOpen, onClose, onCreateRoom, onJoinRoom, joinError, onClearJoinError, initialTab }) => {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab ?? 'create');

  // The modal stays mounted, so re-apply initialTab each time it opens.
  useEffect(() => {
    if (isOpen && initialTab) setTab(initialTab);
  }, [isOpen, initialTab]);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('codecollab_displayName') || '');
  const [roomId, setRoomId] = useState('');
  const [generatedId] = useState(generateRoomId);

  useEffect(() => {
    localStorage.setItem('codecollab_displayName', displayName);
  }, [displayName]);
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    if (!displayName.trim()) return;
    onCreateRoom(displayName.trim(), generatedId);
    onClose();
  };

  const handleJoin = () => {
    if (!displayName.trim() || !roomId.trim()) return;
    onClearJoinError?.();
    onJoinRoom(displayName.trim(), roomId.trim().toUpperCase());
    // Don't close — wait for approval or show error
  };

  const submit = () => (tab === 'create' ? handleCreate() : handleJoin());
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
  };

  const tabs = (
    <div className="flex px-1">
      {(['create', 'join'] as const).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          aria-pressed={tab === t}
          className={ms.tab(tab === t)}
        >
          {t === 'create' ? (
            <><Plus size={14} /> Host Room</>
          ) : (
            <><LogIn size={14} /> Join Room</>
          )}
        </button>
      ))}
    </div>
  );

  const footer = (
    <>
      <button type="button" onClick={onClose} className={ms.btnSecondary}>
        Cancel
      </button>
      {tab === 'create' ? (
        <button type="button" onClick={handleCreate} disabled={!displayName.trim()} className={ms.btnPrimary}>
          Create & Host Room
        </button>
      ) : (
        <button type="button" onClick={handleJoin} disabled={!displayName.trim() || !roomId.trim()} className={ms.btnPrimary}>
          Request to Join
        </button>
      )}
    </>
  );

  return (
    <ModalSurface
      isOpen={isOpen}
      onClose={onClose}
      title="Live Collaboration"
      subtitle={tab === 'create' ? 'Host a room and share the code with collaborators.' : 'Enter a room code to request access from the host.'}
      icon={<Users size={16} />}
      toolbar={tabs}
      footer={footer}
      width={480}
    >
      <div className="space-y-3">
        {/* Display Name (shared by both tabs) */}
        <div>
          <label htmlFor="collab-display-name" className={ms.label}>Display name</label>
          <input
            id="collab-display-name"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={onEnter}
            placeholder="e.g. John"
            maxLength={30}
            className={ms.input}
          />
        </div>

        {tab === 'create' ? (
          /* Generated Room ID */
          <div>
            <span className={ms.label}>Room ID</span>
            <div className="flex gap-2">
              <div className="flex h-8 flex-1 select-all items-center rounded-ctl border border-line bg-bg px-2.5 font-mono text-[13px] font-medium tracking-[0.3em] text-fg">
                {generatedId}
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className={`${ms.btnSecondary} w-8 px-0`}
                title="Copy Room ID"
                aria-label="Copy Room ID"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-fg-secondary" />}
              </button>
            </div>
          </div>
        ) : (
          /* Room ID input */
          <div>
            <label htmlFor="collab-room-id" className={ms.label}>Room ID</label>
            <input
              id="collab-room-id"
              type="text"
              value={roomId}
              onChange={e => { setRoomId(e.target.value.toUpperCase()); onClearJoinError?.(); }}
              onKeyDown={onEnter}
              placeholder="e.g. A3K7M2"
              maxLength={10}
              aria-invalid={!!joinError}
              className={`${ms.input} font-mono text-[13px] uppercase tracking-[0.3em] ${joinError ? 'border-danger focus:border-danger' : ''}`}
            />
            {joinError && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-danger">
                <AlertCircle size={12} className="shrink-0" />
                {joinError}
              </p>
            )}
          </div>
        )}
      </div>
    </ModalSurface>
  );
};
