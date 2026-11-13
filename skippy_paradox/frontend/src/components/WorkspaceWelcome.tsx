import React from 'react';
import { Users, LogIn, Plus, FileCode, Cpu } from 'lucide-react';
import DotField from './DotField';

export interface WorkspaceWelcomeProps {
  /** Opens the collab modal (create tab). */
  onCreateRoom: () => void;
  /** Opens the collab modal (join tab). */
  onJoinRoom: () => void;
  /** Starts the inline "new file" flow in the explorer. */
  onNewFile?: () => void;
  /** Creates a blank snippet. */
  onNewSnippet?: () => void;
  /** Smaller layout for the mobile editor pane. */
  compact?: boolean;
  /** Render the faint dot background (10% opacity max). */
  showBackground?: boolean;
}

const btnBase =
  'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-ctl text-[12px] font-medium transition-colors ' +
  'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent';

export const WorkspaceWelcome: React.FC<WorkspaceWelcomeProps> = ({
  onCreateRoom, onJoinRoom, onNewFile, onNewSnippet, compact = false, showBackground = true,
}) => (
  <div className="relative flex-1 h-full flex flex-col items-center justify-center bg-bg overflow-hidden font-sans">
    {showBackground && (
      <div className="pointer-events-none absolute inset-0 z-0 opacity-10" aria-hidden="true">
        <DotField
          dotRadius={1.5}
          dotSpacing={16}
          bulgeStrength={40}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          gradientFrom="rgba(86, 192, 242, 0.6)"
          gradientTo="rgba(139, 139, 153, 0.4)"
          glowColor="#0A0A0F"
        />
      </div>
    )}

    <div className={`relative z-10 w-full ${compact ? 'max-w-xs px-4' : 'max-w-sm px-6'} flex flex-col items-center text-center`}>
      <h1 className={`${compact ? 'text-[22px]' : 'text-[28px]'} font-semibold tracking-tight text-fg select-none`}>
        Shenron
      </h1>
      <p className="mt-1.5 text-[13px] text-fg-secondary">Code together, with an AI teammate</p>

      <div className={`mt-6 flex ${compact ? 'flex-col w-full' : 'flex-row'} gap-2`}>
        <button
          type="button"
          onClick={onCreateRoom}
          className={`${btnBase} bg-accent hover:bg-accent-hover text-[#0A0A0F]`}
        >
          <Users size={14} /> Create room
        </button>
        <button
          type="button"
          onClick={onJoinRoom}
          className={`${btnBase} border border-line bg-bg-elevated hover:border-line-hover text-fg`}
        >
          <LogIn size={14} className="text-fg-secondary" /> Join room
        </button>
      </div>

      {(onNewFile || onNewSnippet) && (
        <div className="mt-3 flex items-center gap-1 text-[12px] text-fg-secondary">
          <span className="text-fg-muted">or work solo:</span>
          {onNewFile && (
            <button
              type="button"
              onClick={onNewFile}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-ctl hover:bg-white/5 hover:text-fg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <Plus size={14} /> New File
            </button>
          )}
          {onNewSnippet && (
            <button
              type="button"
              onClick={onNewSnippet}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-ctl hover:bg-white/5 hover:text-fg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <FileCode size={14} /> Snippet
            </button>
          )}
        </div>
      )}

      <div className="mt-6 inline-flex items-center gap-1.5 h-6 px-2 rounded-ctl border border-line bg-bg-panel text-[11px] text-fg-secondary">
        <Cpu size={12} className="text-fg-muted" />
        Works offline with Ollama
      </div>
    </div>
  </div>
);

export default WorkspaceWelcome;
