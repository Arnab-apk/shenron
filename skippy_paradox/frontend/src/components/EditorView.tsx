import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ModernMonacoEditor } from './ModernMonacoEditor';
import { CollabMonacoEditor } from './CollabMonacoEditor';
import { FileExplorer } from './FileExplorer';
import { CollabBar } from './CollabBar';
import { ChatPanel } from './ChatPanel';
import { HarnessPanel } from './HarnessPanel';
import { GeminiPanel } from './GeminiPanel';
import VoiceLobbyPanel from './VoiceLobbyPanel';
import { CodeRunner } from './CodeRunner';
import { TerminalPanel } from './TerminalPanel';
import { WorkspaceBar } from './WorkspaceBar';
import { WorkspaceController } from '../hooks/useWorkspace';
import { WorkspaceWelcome } from './WorkspaceWelcome';
import { StoredFile } from '../services/storageService';
import { hydrateFiles } from '../services/harnessService';
import { SharedFileInfo } from '../services/collabService';
import { VoiceManager } from '../services/voiceManager';
import { useTheme } from '../hooks/useTheme';
import { detectLanguage, detectLanguageAI } from '../utils/detectLanguage';
import {
  FileCode, Upload, Code2, Sun, Moon, Files, Bot, Command,
  Github, Users, X, MessageSquare, Menu, Headphones, Play, Terminal,
} from 'lucide-react';
import {
  JavaScript, TypeScript, Python, CPlusPlus, C, Java, Go, RustDark, Ruby, PHP,
} from 'developer-icons';

/* ── Language icon map ─────────────────────────────────────────────── */
const langIconMap: Record<string, { icon: any }> = {
  JavaScript: { icon: JavaScript }, TypeScript: { icon: TypeScript },
  Python: { icon: Python }, 'C++': { icon: CPlusPlus }, C: { icon: C },
  Java: { icon: Java }, Go: { icon: Go }, Rust: { icon: RustDark },
  Ruby: { icon: Ruby }, PHP: { icon: PHP },
};

function LanguageIcon({ language, size = 16, className = '' }: { language: string; size?: number; className?: string }) {
  const entry = langIconMap[language];
  if (!entry) return <FileCode size={size} className={className} />;
  const Icon = entry.icon;
  return <div className={className} style={{ display: 'inline-flex', alignItems: 'center' }}><Icon size={size} /></div>;
}

/* ── Resize handle ─────────────────────────────────────────────────── */
function ResizeHandle({ vertical = false }: { vertical?: boolean }) {
  return (
    <Separator
      className={`relative shrink-0 select-none bg-line transition-colors hover:bg-accent data-[separator=active]:bg-accent
        before:absolute before:content-[''] ${vertical
          ? 'h-px cursor-row-resize before:inset-x-0 before:-top-1 before:-bottom-1'
          : 'w-px cursor-col-resize before:inset-y-0 before:-left-1 before:-right-1'}`}
    />
  );
}

/* ── Types ─────────────────────────────────────────────────────────── */
interface CollabHook {
  status: import('../services/collabService').CollabStatus;
  roomId: string | null;
  isHost: boolean;
  displayName: string;
  color: string;
  members: import('../services/collabService').CollabMember[];
  pending: import('../services/collabService').PendingRequest[];
  sharedFiles: SharedFileInfo[];
  provider: import('../services/collabService').CollabProvider | null;
  toasts: import('../hooks/useCollabRoom').CollabToast[];
  chatMessages: import('../services/collabService').ChatMessage[];
  peerId: string;
  leaveRoom: () => void;
  approveJoin: (peerId: string) => void;
  rejectJoin: (peerId: string) => void;
  shareFile: (file: { id: string; name: string; language: string; content: string }) => void;
  unshareFile: (fileId: string) => void;
  dismissToast: (id: string) => void;
  sendChatMessage: (text: string) => void;
  voiceManager: VoiceManager;
}

interface EditorViewProps {
  workspace: WorkspaceController;
  files: StoredFile[];
  activeFileId: string | null;
  loadingFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileCreate: (name?: string, content?: string, language?: string) => void;
  onAgentFileCreate?: (name: string, content: string, language?: string) => void;
  onFileDelete: (id: string) => void;
  onFileUpload: (file: File) => void;
  onCodeChange: (id: string, newCode: string) => void;
  onLanguageChange: (id: string, language: string) => void;
  onOpenGitHub: () => void;
  onOpenGitHubPush: () => void;
  onOpenCollab: () => void;
  onRepoDelete?: (repoKey: string) => void;
  collab: CollabHook;
  /** Opens the command palette (activity bar). Optional for backwards compatibility. */
  onOpenCommandPalette?: () => void;
  /** Opens the collab modal on its Join tab. Falls back to onOpenCollab. */
  onJoinCollab?: () => void;
}

type MobilePane = 'editor' | 'runner' | 'terminal' | 'gemini' | 'chat' | 'voice';

/* ── Component ─────────────────────────────────────────────────────── */
export const EditorView: React.FC<EditorViewProps> = ({
  files, activeFileId, loadingFileId, onFileSelect, onFileCreate, onAgentFileCreate, onFileDelete, onFileUpload,
  workspace, onCodeChange, onLanguageChange, onOpenGitHub, onOpenGitHubPush, onOpenCollab, onRepoDelete, collab,
  onOpenCommandPalette, onJoinCollab,
}) => {
  const openJoinCollab = onJoinCollab ?? onOpenCollab;
  const { isDark, toggleTheme } = useTheme();

  const [triggerNewFile, setTriggerNewFile] = useState(0);

  const activeFile = useMemo((): StoredFile | null => {
    if (!activeFileId) return null;
    const local = files.find(f => f.id === activeFileId);
    if (local) return local;
    const shared = collab.sharedFiles.find(f => f.id === activeFileId);
    if (shared) return { id: shared.id, name: shared.name, language: shared.language, content: '', contentHash: '', lastModified: Date.now() } as StoredFile;
    return null;
  }, [activeFileId, files, collab.sharedFiles]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGeminiOpen, setIsGeminiOpen] = useState(true);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ ln: 1, col: 1 });
  const [selectionCount, setSelectionCount] = useState(0);
  const [fontSize] = useState(() => parseInt(localStorage.getItem('editor-font-size') || '16', 10));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastChatCountRef = useRef(0);
  const isInRoom = collab.status === 'connected' || collab.status === 'waiting-approval' || collab.status === 'connecting';

  useEffect(() => { setCursorPosition({ ln: 1, col: 1 }); setSelectionCount(0); }, [activeFileId]);

  useEffect(() => {
    if (!activeFile || activeFile.language) return;
    const syncLang = detectLanguage(activeFile.name, activeFile.content);
    if (syncLang) onLanguageChange(activeFile.id, syncLang);
    if (activeFile.content?.trim().length > 20) {
      detectLanguageAI(activeFile.name, activeFile.content).then(aiLang => {
        if (aiLang && aiLang !== syncLang) onLanguageChange(activeFile.id, aiLang);
      });
    }
  }, [activeFile?.id, activeFile?.language, activeFile?.name, activeFile?.content, onLanguageChange]);

  useEffect(() => { localStorage.setItem('editor-font-size', fontSize.toString()); }, [fontSize]);

  useEffect(() => {
    const currentCount = collab.chatMessages.length;

    if (isChatOpen) {
      setUnreadChatCount(0);
      lastChatCountRef.current = currentCount;
      return;
    }

    if (collab.status === 'connected' && currentCount > lastChatCountRef.current) {
      setUnreadChatCount((prev) => prev + (currentCount - lastChatCountRef.current));
    }

    lastChatCountRef.current = currentCount;
  }, [collab.chatMessages.length, collab.status, isChatOpen]);

  useEffect(() => {
    if (!collab.roomId) {
      setUnreadChatCount(0);
      lastChatCountRef.current = 0;
      setIsChatOpen(false);
      setIsVoiceOpen(false);
      setMobilePane('editor');
    }
  }, [collab.roomId]);

  useEffect(() => {
    if (!isInRoom && (mobilePane === 'chat' || mobilePane === 'voice')) {
      setMobilePane('editor');
    }
  }, [isInRoom, mobilePane]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sharedFileIds = useMemo(() => new Set(collab.sharedFiles.map(f => f.id)), [collab.sharedFiles]);
  const isActiveFileShared = activeFileId ? sharedFileIds.has(activeFileId) : false;

  const collabFileContents = useMemo(() => {
    const m = new Map<string, StoredFile>();
    for (const sf of collab.sharedFiles) {
      const local = files.find(f => f.id === sf.id);
      if (local) m.set(sf.id, local);
    }
    return m;
  }, [collab.sharedFiles, files]);

  const handleAddToCollab = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    try {
      const [loaded] = await hydrateFiles([file]);
      collab.shareFile({ id: loaded.id, name: loaded.path || loaded.name, language: loaded.language, content: loaded.content });
    } catch (error: any) { window.alert(error.message || 'Could not load the file for sharing.'); }
  }, [files, collab]);

  const handleRemoveFromCollab = useCallback((fileId: string) => { collab.unshareFile(fileId); }, [collab]);
  const handleSelectCollabFile = useCallback((fileId: string) => { onFileSelect(fileId); }, [onFileSelect]);
  const handleMobileFileSelect = useCallback((fileId: string) => {
    onFileSelect(fileId);
    setIsSidebarOpen(false);
    setMobilePane('editor');
  }, [onFileSelect]);

  /* ── Editor tabs (UI-only list of recently opened files) ─────────── */
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  useEffect(() => {
    if (!activeFileId) return;
    setOpenTabIds(prev => (prev.includes(activeFileId) ? prev : [...prev, activeFileId]));
  }, [activeFileId]);
  const openTabs = useMemo(() => {
    const result: Array<{ id: string; name: string; language: string; shared: boolean }> = [];
    for (const id of openTabIds) {
      const local = files.find(f => f.id === id);
      const shared = collab.sharedFiles.find(f => f.id === id);
      if (local) result.push({ id, name: local.name, language: local.language, shared: sharedFileIds.has(id) });
      else if (shared) result.push({ id, name: shared.name, language: shared.language, shared: true });
    }
    return result;
  }, [openTabIds, files, collab.sharedFiles, sharedFileIds]);
  const closeTab = useCallback((id: string) => {
    const index = openTabs.findIndex(t => t.id === id);
    const remaining = openTabs.filter(t => t.id !== id);
    setOpenTabIds(prev => prev.filter(tabId => tabId !== id));
    if (id === activeFileId && remaining.length) onFileSelect(remaining[Math.max(0, index - 1)].id);
  }, [openTabs, activeFileId, onFileSelect]);

  const [isExplorerOpen, setIsExplorerOpen] = useState(true);

  const iconBtn = 'inline-flex items-center justify-center w-7 h-7 rounded-ctl text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40 disabled:cursor-not-allowed';
  const emptyPane = 'h-full flex flex-col items-center justify-center bg-bg text-fg-muted';

  const waitingOverlay = collab.status === 'waiting-approval' && (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0A0F]/95">
      <Users size={20} className="text-fg-secondary mb-3" />
      <p className="text-[13px] font-medium text-fg">Waiting for host approval…</p>
      <p className="text-[12px] mt-1 text-fg-secondary">The room host will accept or reject your request.</p>
      <button onClick={collab.leaveRoom} className="mt-4 h-7 px-3 rounded-ctl border border-line bg-bg-elevated hover:border-line-hover text-[12px] font-medium text-danger transition-colors">Cancel</button>
    </div>
  );

  const renderEditor = (file: StoredFile) => (
    isActiveFileShared && collab.provider && collab.status === 'connected' ? (
      <CollabMonacoEditor file={file} theme={isDark ? 'dark' : 'light'} fontSize={fontSize}
        provider={collab.provider} onChange={(code) => onCodeChange(file.id, code)}
        onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
        onSelectionChange={(count) => setSelectionCount(count)} />
    ) : (
      <ModernMonacoEditor file={file} theme={isDark ? 'dark' : 'light'} fontSize={fontSize}
        onChange={(code) => onCodeChange(file.id, code)}
        onCursorChange={(ln, col) => setCursorPosition({ ln, col })}
        onSelectionChange={(count) => setSelectionCount(count)} />
    )
  );

  const sideBtn = 'inline-flex items-center gap-1 h-6 px-1.5 rounded-ctl text-[11px] text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent';

  /* Agent panel: Harness (default) | Chat (GeminiPanel). Chat mounts on first use, then stays mounted. */
  const [agentView, setAgentView] = useState<'harness' | 'chat'>('harness');
  const [chatMounted, setChatMounted] = useState(false);
  useEffect(() => { if (agentView === 'chat') setChatMounted(true); }, [agentView]);

  const renderHarness = () => (
    <div className="flex flex-col h-full min-h-0">
      <div role="tablist" aria-label="Agent view" className="flex items-center gap-0.5 h-9 px-2 shrink-0 border-b border-line bg-bg-panel">
        {([['harness', 'Harness'], ['chat', 'Chat']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={agentView === id} onClick={() => setAgentView(id)}
            className={`h-6 px-2.5 rounded-ctl text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              agentView === id ? 'bg-bg-elevated text-fg border border-line' : 'text-fg-secondary hover:text-fg border border-transparent'
            }`}>
            {label}
          </button>
        ))}
      </div>
      <div className={agentView === 'harness' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
        <HarnessPanel beginAgent={workspace.beginAgent} provider={collab.provider} sharedFiles={collab.sharedFiles}
          activeFile={activeFile}
          allFiles={files}
          onCodeChange={(fileId, content) => onCodeChange(fileId, content)}
          onFileCreate={onFileCreate}
          onAgentFileCreate={onAgentFileCreate || onFileCreate}
        />
      </div>
      {chatMounted && (
        <div className={agentView === 'chat' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
          <GeminiPanel
            activeFile={activeFile}
            allFiles={files}
            onCodeChange={(fileId, content) => onCodeChange(fileId, content)}
            onFileCreate={() => onFileCreate()}
            onAgentFileCreate={onAgentFileCreate || onFileCreate}
          />
        </div>
      )}
    </div>
  );

  const explorerList = (onSelect: (id: string) => void) => (
    <FileExplorer files={files} activeFileId={activeFileId} loadingFileId={loadingFileId}
      onFileSelect={onSelect} onFileDelete={onFileDelete} onRepoDelete={onRepoDelete}
      onFileCreate={onFileCreate} triggerNewFile={triggerNewFile}
      isInRoom={isInRoom} isHost={collab.isHost} sharedFiles={collab.sharedFiles}
      collabFileContents={collabFileContents} onAddToCollab={handleAddToCollab}
      onRemoveFromCollab={handleRemoveFromCollab} onSelectCollabFile={handleSelectCollabFile} />
  );

  const rightPanelOpen = isGeminiOpen || (isInRoom && (isChatOpen || isVoiceOpen));

  return (
    <div className="flex flex-col h-[100dvh] bg-bg text-fg font-sans overflow-hidden overflow-x-hidden">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

      {/* ── Title bar: brand + project workspace ────────────────────── */}
      <header className="shrink-0 flex items-start gap-1 bg-bg-panel border-b border-line z-20">
        <div className="flex items-center h-11 pl-2 md:pl-3 gap-1 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open file sidebar"
            className={`md:hidden ${iconBtn}`}>
            <Menu size={16} />
          </button>
          <span className="font-semibold tracking-tight text-[13px] text-fg select-none pr-2">
            Shenron
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <WorkspaceBar workspace={workspace} room={collab.provider} />
        </div>
        {/* Mobile-only quick actions (desktop uses the activity bar) */}
        <div className="flex md:hidden items-center h-11 pr-2 gap-1 shrink-0">
          <button onClick={onOpenGitHubPush} aria-label="Push code to GitHub" title="Push to GitHub" className={iconBtn}>
            <Github size={16} />
          </button>
          {!isInRoom && (
            <button onClick={onOpenCollab}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-ctl border border-line bg-bg-elevated hover:border-line-hover text-[12px] font-medium text-fg transition-colors">
              <Users size={14} className="text-fg-secondary" /> Collab
            </button>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Activity bar (desktop) */}
        <nav aria-label="Activity bar" className="hidden md:flex w-12 shrink-0 flex-col items-center justify-between bg-bg-panel border-r border-line py-1">
          <div className="flex flex-col items-center w-full">
            <ActivityItem label="Explorer" active={isExplorerOpen} onClick={() => setIsExplorerOpen(v => !v)} expanded={isExplorerOpen}>
              <Files size={18} />
            </ActivityItem>
            <ActivityItem
              label={isGeminiOpen ? 'Close AI Assistant panel' : 'Open AI Assistant panel'}
              title={isGeminiOpen ? 'Close Agent' : 'Open Agent'}
              active={isGeminiOpen} expanded={isGeminiOpen}
              onClick={() => setIsGeminiOpen(prev => !prev)}>
              <Bot size={18} />
            </ActivityItem>
            {!isInRoom ? (
              <ActivityItem label="Collab" title="Collaborate" onClick={onOpenCollab}>
                <Users size={18} />
              </ActivityItem>
            ) : (
              <>
                <ActivityItem
                  label={isChatOpen ? 'Close chat panel' : 'Open chat panel'}
                  title={isChatOpen ? 'Close Chat' : 'Open Chat'}
                  active={isChatOpen} expanded={isChatOpen}
                  onClick={() => setIsChatOpen(prev => !prev)}
                  badge={!isChatOpen && unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : String(unreadChatCount)) : undefined}>
                  <MessageSquare size={18} />
                </ActivityItem>
                <ActivityItem
                  label={isVoiceOpen ? 'Close voice panel' : 'Open voice panel'}
                  title={isVoiceOpen ? 'Close Voice' : 'Open Voice'}
                  active={isVoiceOpen} expanded={isVoiceOpen}
                  onClick={() => setIsVoiceOpen(prev => !prev)}>
                  <Headphones size={18} />
                </ActivityItem>
              </>
            )}
            <ActivityItem label="Push code to GitHub" title="Push to GitHub" onClick={onOpenGitHubPush}>
              <Github size={18} />
            </ActivityItem>
            {onOpenCommandPalette && (
              <ActivityItem label="Open command palette" title="Command palette (Ctrl+K)" onClick={onOpenCommandPalette}>
                <Command size={18} />
              </ActivityItem>
            )}
          </div>
          <div className="flex flex-col items-center w-full">
            <ActivityItem
              label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </ActivityItem>
          </div>
        </nav>

        <div className="flex flex-1 min-w-0 flex-col">
          <div className="flex flex-1 min-h-0 overflow-hidden relative">

            {/* Mobile sidebar overlay */}
            {isSidebarOpen && (
              <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Mobile sidebar drawer */}
            <div className={`fixed md:hidden inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] flex flex-col bg-bg-panel border-r border-line transform transition-transform duration-200 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex items-center justify-between h-11 pl-3 pr-2 border-b border-line">
                <span className="text-[13px] font-semibold tracking-tight text-fg">Shenron</span>
                <button onClick={() => setIsSidebarOpen(false)} aria-label="Close file sidebar" className={iconBtn}>
                  <X size={16} />
                </button>
              </div>
              <div role="toolbar" aria-label="File actions" className="flex items-center gap-0.5 px-1 h-9 border-b border-line">
                <button onClick={() => { onFileCreate(); setIsSidebarOpen(false); }} title="Create scratchpad snippet" className={sideBtn}>
                  <FileCode size={14} /> Snippet
                </button>
                <button onClick={() => fileInputRef.current?.click()} aria-label="Upload file" title="Upload File" className={sideBtn}>
                  <Upload size={14} /> Upload
                </button>
                <button onClick={onOpenGitHub} aria-label="Import repository from GitHub" title="Import repository from GitHub" className={sideBtn}>
                  <Github size={14} /> Import
                </button>
                <button onClick={onOpenGitHubPush} aria-label="Push changes to GitHub" title="Push code to GitHub" className={sideBtn}>
                  <Upload size={14} /> Push
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-1 py-1 custom-scrollbar">
                {explorerList(handleMobileFileSelect)}
              </div>
            </div>

            {/* Desktop: resizable panel group */}
            <Group orientation="horizontal" className="flex-1 min-h-0 hidden md:flex" id="editor-layout">

              {/* Explorer sidebar */}
              {isExplorerOpen && (
                <>
                  <Panel id="explorer" defaultSize="18%" minSize="12%" maxSize="35%" className="flex flex-col bg-bg-panel">
                    <div className="flex-1 overflow-y-auto px-1 pt-1 pb-2 custom-scrollbar">
                      {explorerList(onFileSelect)}
                    </div>
                    {/* Secondary file actions (FileExplorer owns the header + New file) */}
                    <div role="toolbar" aria-label="File actions" className="flex items-center gap-0.5 h-8 px-1 shrink-0 border-t border-line">
                      <button onClick={() => onFileCreate()} title="Create quick scratchpad snippet" className={sideBtn}>
                        <FileCode size={14} /> Snippet
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} aria-label="Upload file" title="Upload File" className={sideBtn}>
                        <Upload size={14} /> Upload
                      </button>
                      <button onClick={onOpenGitHub} aria-label="Import from GitHub" title="Import from GitHub" className={sideBtn}>
                        <Github size={14} /> Import
                      </button>
                    </div>
                  </Panel>
                  <ResizeHandle />
                </>
              )}

              {/* Editor column */}
              <Panel id="editor" defaultSize={rightPanelOpen ? '56%' : '82%'} minSize="30%" className="flex flex-col min-w-0 bg-bg">
                {!activeFile ? (
                  <WorkspaceWelcome
                    onCreateRoom={onOpenCollab}
                    onJoinRoom={openJoinCollab}
                    onNewFile={() => setTriggerNewFile(prev => prev + 1)}
                    onNewSnippet={() => onFileCreate()}
                  />
                ) : (
                  <>
                    {/* Tabs row */}
                    <div className="flex items-stretch h-9 shrink-0 bg-bg-panel border-b border-line">
                      <div role="tablist" aria-label="Open files" className="flex flex-1 min-w-0 items-stretch overflow-x-auto scrollbar-hide">
                        {openTabs.map(tab => {
                          const active = tab.id === activeFileId;
                          return (
                            <div key={tab.id}
                              className={`group relative flex items-center gap-1.5 pl-3 pr-1 max-w-[220px] border-r border-line text-[12px] select-none cursor-pointer transition-colors ${
                                active ? 'bg-bg text-fg' : 'text-fg-secondary hover:text-fg hover:bg-white/[0.03]'
                              }`}
                              onClick={() => onFileSelect(tab.id)}
                            >
                              {active && <span className="absolute inset-x-0 top-0 h-px bg-accent" aria-hidden="true" />}
                              <button role="tab" aria-selected={active} className="flex items-center gap-1.5 min-w-0 focus:outline-none focus-visible:underline"
                                onClick={(e) => { e.stopPropagation(); onFileSelect(tab.id); }}>
                                <LanguageIcon language={tab.language} size={14} className="shrink-0" />
                                <span className="truncate">{tab.name}</span>
                                {tab.shared && <Users size={12} className="shrink-0 text-fg-muted" aria-label="Shared" />}
                              </button>
                              {openTabs.length > 1 && (
                                <button
                                  aria-label={`Close ${tab.name}`}
                                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-[4px] text-fg-muted hover:text-fg hover:bg-white/10 ${active ? '' : 'opacity-0 group-hover:opacity-100'} focus:opacity-100`}>
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-0.5 px-1.5 shrink-0">
                        <button aria-label="Run current file" aria-pressed={isOutputOpen} disabled={!activeFile} onClick={() => setIsOutputOpen(value => !value)}
                          title="Run file"
                          className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-ctl text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${isOutputOpen ? 'text-fg bg-white/5' : 'text-fg-secondary hover:text-fg hover:bg-white/5'}`}>
                          <Play size={14} /> Run file
                        </button>
                      </div>
                    </div>

                    <Group orientation="vertical" className="flex-1 min-h-0 relative overflow-hidden" id="editor-output">
                      <Panel id="editor-main" defaultSize={isOutputOpen ? '65%' : '100%'} minSize="25%" className="relative overflow-hidden">
                        {waitingOverlay}
                        {renderEditor(activeFile)}
                      </Panel>
                      {isOutputOpen && (
                        <>
                          <ResizeHandle vertical />
                          <Panel id="editor-output-panel" defaultSize="35%" minSize="15%" maxSize="75%" className="overflow-hidden">
                            <CodeRunner
                              code={activeFile.content}
                              language={activeFile.language}
                              fileName={activeFile.name}
                              onClose={() => setIsOutputOpen(false)}
                              onLanguageChange={(newLang) => onLanguageChange(activeFile.id, newLang)}
                            />
                          </Panel>
                        </>
                      )}
                    </Group>
                  </>
                )}
              </Panel>

              {/* Right panel: agent */}
              {isGeminiOpen && (
                <>
                  <ResizeHandle />
                  <Panel id="agent" defaultSize="26%" minSize="18%" maxSize="45%" className="flex flex-col min-w-0 bg-bg-panel">
                    {renderHarness()}
                  </Panel>
                </>
              )}

              {/* Chat panel (collab only) */}
              {isInRoom && isChatOpen && (
                <>
                  <ResizeHandle />
                  <Panel id="chat" defaultSize="22%" minSize="16%" maxSize="40%" className="flex flex-col min-w-0 bg-bg-panel">
                    <ChatPanel isOpen={true} messages={collab.chatMessages} selfPeerId={collab.peerId}
                      onSendMessage={collab.sendChatMessage} canSend={collab.status === 'connected'} onClose={() => setIsChatOpen(false)} />
                  </Panel>
                </>
              )}

              {/* Voice panel (collab only) */}
              {isInRoom && isVoiceOpen && (
                <>
                  <ResizeHandle />
                  <Panel id="voice" defaultSize="20%" minSize="14%" maxSize="35%" className="flex flex-col min-w-0 bg-bg-panel">
                    <VoiceLobbyPanel
                      isOpen={true}
                      members={collab.members}
                      selfPeerId={collab.peerId}
                      provider={collab.provider}
                      canUseVoice={collab.status === 'connected'}
                      onClose={() => setIsVoiceOpen(false)}
                      voiceManager={collab.voiceManager}
                    />
                  </Panel>
                </>
              )}
            </Group>

            {/* Mobile: non-resizable layout */}
            <div className="flex-1 flex flex-col min-w-0 md:hidden">
              <div role="tablist" aria-label="Mobile panes" className="shrink-0 h-9 border-b border-line bg-bg-panel px-1 flex items-stretch overflow-x-auto scrollbar-hide">
                {([
                  { id: 'editor', label: 'Editor', icon: <Code2 size={14} /> },
                  { id: 'runner', label: 'Run', icon: <Play size={14} /> },
                  { id: 'terminal', label: 'Terminal', icon: <Terminal size={14} /> },
                  { id: 'gemini', label: 'Agent', icon: <Bot size={14} /> },
                  ...(isInRoom ? [
                    { id: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
                    { id: 'voice', label: 'Voice', icon: <Headphones size={14} /> },
                  ] : []),
                ] as Array<{ id: MobilePane; label: string; icon: React.ReactNode }>).map((tab) => {
                  const active = mobilePane === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setMobilePane(tab.id); if (tab.id === 'terminal') setIsTerminalOpen(true); }}
                      className={`relative shrink-0 flex items-center gap-1.5 px-3 text-[12px] font-medium transition-colors ${active ? 'text-fg' : 'text-fg-secondary'}`}
                    >
                      {tab.icon} {tab.label}
                      {tab.id === 'chat' && mobilePane !== 'chat' && unreadChatCount > 0 && (
                        <span className="min-w-[16px] h-4 px-1 rounded-full bg-accent text-[#0A0A0F] text-[10px] leading-4 font-semibold">
                          {unreadChatCount > 99 ? '99+' : unreadChatCount}
                        </span>
                      )}
                      {active && <span className="absolute inset-x-2 bottom-0 h-px bg-accent" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              {mobilePane === 'editor' && !activeFile ? (
                <WorkspaceWelcome
                  compact
                  onCreateRoom={onOpenCollab}
                  onJoinRoom={openJoinCollab}
                  onNewFile={() => setTriggerNewFile(prev => prev + 1)}
                  onNewSnippet={() => onFileCreate()}
                />
              ) : mobilePane === 'editor' ? (
                <div className="flex-1 relative overflow-hidden bg-bg">
                  {waitingOverlay}
                  {activeFile ? renderEditor(activeFile) : (
                    <div className={emptyPane}>
                      <FileCode size={16} className="mb-2" />
                      <p className="text-[12px]">Select a file to edit</p>
                    </div>
                  )}
                </div>
              ) : mobilePane === 'runner' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  {activeFile ? (
                    <CodeRunner
                      code={activeFile.content}
                      language={activeFile.language}
                      fileName={activeFile.name}
                      onLanguageChange={(newLang) => onLanguageChange(activeFile.id, newLang)}
                    />
                  ) : (
                    <div className={emptyPane}>
                      <Play size={16} className="mb-2" />
                      <p className="text-[12px]">Open a file to run code</p>
                    </div>
                  )}
                </div>
              ) : mobilePane === 'gemini' ? (
                <div className="flex-1 min-h-0 overflow-hidden bg-bg-panel">
                  {renderHarness()}
                </div>
              ) : mobilePane === 'chat' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  {isInRoom ? (
                    <ChatPanel
                      isOpen={true}
                      messages={collab.chatMessages}
                      selfPeerId={collab.peerId}
                      onSendMessage={collab.sendChatMessage}
                      canSend={collab.status === 'connected'}
                      onClose={() => setMobilePane('editor')}
                    />
                  ) : (
                    <div className={emptyPane}>
                      <MessageSquare size={16} className="mb-2" />
                      <p className="text-[12px]">Join a room to use chat</p>
                    </div>
                  )}
                </div>
              ) : mobilePane === 'voice' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  {isInRoom ? (
                    <VoiceLobbyPanel
                      isOpen={true}
                      members={collab.members}
                      selfPeerId={collab.peerId}
                      provider={collab.provider}
                      canUseVoice={collab.status === 'connected'}
                      onClose={() => setMobilePane('editor')}
                      voiceManager={collab.voiceManager}
                    />
                  ) : (
                    <div className={emptyPane}>
                      <Headphones size={16} className="mb-2" />
                      <p className="text-[12px]">Join a room to use voice</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Bottom panel: terminal (single instance, kept mounted when hidden) ── */}
          <div className={mobilePane === 'terminal' ? 'flex flex-col shrink-0' : 'hidden md:flex md:flex-col shrink-0'}>
            <TerminalPanel workspace={workspace} room={collab.provider} visible={isTerminalOpen} onHide={() => setIsTerminalOpen(false)} />
          </div>
        </div>
      </div>

      {/* ── Collab bar ──────────────────────────────────────────────── */}
      {isInRoom && collab.roomId && (
        <CollabBar roomId={collab.roomId} status={collab.status} isHost={collab.isHost}
          members={collab.members} pending={collab.pending} toasts={collab.toasts}
          onApprove={collab.approveJoin} onReject={collab.rejectJoin} onLeave={collab.leaveRoom}
          onDismissToast={collab.dismissToast} />
      )}

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <footer className="hidden md:flex h-[22px] shrink-0 items-center justify-between px-2 bg-bg-panel border-t border-line text-[11px] text-fg-secondary select-none">
        <div className="flex items-center h-full">
          <button
            onClick={() => setIsTerminalOpen(prev => !prev)}
            aria-label={isTerminalOpen ? 'Hide Terminal' : 'Open Terminal'}
            aria-expanded={isTerminalOpen}
            title={isTerminalOpen ? 'Hide Terminal' : 'Open Terminal'}
            className={`flex items-center gap-1 h-full px-2 transition-colors hover:bg-white/5 hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${isTerminalOpen ? 'text-fg' : ''}`}
          >
            <Terminal size={12} />
            <span>Terminal</span>
          </button>
          <span className="flex items-center gap-1 px-2">
            <FileCode size={12} />
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
          {isInRoom && (
            <span className="flex items-center gap-1 px-2">
              <Users size={12} />
              {collab.members.length} in room
            </span>
          )}
        </div>
        <div className="flex items-center h-full">
          {activeFile && (
            <>
              <span className="px-2">
                Ln {cursorPosition.ln}, Col {cursorPosition.col}{selectionCount > 0 && ` (${selectionCount} selected)`}
              </span>
              <span className="flex items-center gap-1 px-2">
                <LanguageIcon language={activeFile.language} size={12} />
                {activeFile.language || 'Detecting…'}
              </span>
            </>
          )}
          <span className="px-2 text-fg-muted">Shenron</span>
        </div>
      </footer>

      {/* ── Toasts ──────────────────────────────────────────────────── */}
      {collab.toasts.length > 0 && (
        <div className="fixed top-12 left-3 right-3 sm:left-auto sm:right-3 z-[100] flex flex-col gap-2 pointer-events-none">
          {collab.toasts.map(toast => (
            <div key={toast.id}
              className={`pointer-events-auto relative flex items-center gap-2.5 pl-3 pr-2 py-2 min-w-[240px] max-w-[360px] rounded-panel border border-line bg-bg-elevated shadow-subtle text-[12px] overflow-hidden
                ${toast.exiting ? 'animate-toast-out' : 'animate-fade-in-up'}`}
            >
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                toast.type === 'error'   ? 'bg-danger' :
                toast.type === 'success' ? 'bg-success' :
                toast.type === 'warning' ? 'bg-[#F2B66B]' : 'bg-accent'
              }`} aria-hidden="true" />

              <div className="flex-1 min-w-0">
                {toast.fileName && (
                  <div className="truncate font-medium text-[12px] text-fg mb-0.5">
                    {toast.destination === 'collab' ? 'Shared · ' : toast.destination === 'myfiles' ? 'My files · ' : ''}{toast.fileName}
                  </div>
                )}
                <span className={`leading-snug ${toast.type === 'error' ? 'text-danger' : 'text-fg-secondary'}`}>{toast.message}</span>
              </div>

              <button
                onClick={() => collab.dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-ctl text-fg-muted hover:text-fg hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent">
                <X size={12} />
              </button>

              {!toast.exiting && (
                <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
                  <div className="h-full origin-left bg-line-hover" style={{ animation: 'toastDrain 4s linear forwards' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Activity bar item ─────────────────────────────────────────────── */
function ActivityItem({ label, title, active = false, expanded, onClick, badge, children }: {
  label: string; title?: string; active?: boolean; expanded?: boolean; onClick: () => void; badge?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      aria-expanded={expanded}
      className={`relative flex items-center justify-center w-12 h-11 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
        active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
      }`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent" aria-hidden="true" />}
      {children}
      {badge && (
        <span className="absolute top-1.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[#0A0A0F] text-[10px] leading-4 font-semibold text-center">
          {badge}
        </span>
      )}
    </button>
  );
}
