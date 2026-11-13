import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StoredFile } from '../services/storageService';
import { SharedFileInfo } from '../services/collabService';
import { useTheme } from '../hooks/useTheme';
import {
  File as FileIcon, FileCode, FileJson, FileText, FileImage, FileCog, FileSpreadsheet,
  FileArchive, FileVideo, FileAudio, FileTerminal, FileLock, Database,
  FolderOpen, Folder, ChevronRight, ChevronDown, ChevronsDownUp,
  Trash2, Loader2, Package, Plus, Minus, Check, X, type LucideIcon,
} from 'lucide-react';
import { detectLanguage } from '../utils/detectLanguage';

// ─── Tree Node Types ───────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  fileId?: string;
  isDir: boolean;
  repoKey?: string;
}

// ─── File-type Icons ───────────────────────────────────────────────────

const EXT_ICON: Record<string, LucideIcon> = {};
const registerIcon = (icon: LucideIcon, exts: string) =>
  exts.split(' ').forEach(ext => { EXT_ICON[ext] = icon; });

registerIcon(FileCode,
  'js jsx mjs cjs ts tsx mts cts py pyw pyi c h cpp cc cxx hpp hxx java go rs rb erb php ' +
  'cs kt kts swift dart lua scala r vue svelte astro html htm css scss sass less xml');
registerIcon(FileJson, 'json jsonc json5 map');
registerIcon(FileText, 'md mdx txt rst log adoc');
registerIcon(FileImage, 'png jpg jpeg gif svg webp ico bmp avif');
registerIcon(FileCog, 'yml yaml toml ini cfg conf env editorconfig dockerfile');
registerIcon(FileSpreadsheet, 'csv tsv xls xlsx');
registerIcon(FileArchive, 'zip tar gz tgz rar 7z');
registerIcon(FileVideo, 'mp4 mov webm mkv');
registerIcon(FileAudio, 'mp3 wav ogg flac');
registerIcon(FileTerminal, 'sh bash zsh ps1 bat cmd');
registerIcon(FileLock, 'lock');
registerIcon(Database, 'sql db sqlite');

function iconForFile(name: string, language?: string): LucideIcon {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot + 1) : lower;
  const byExt = EXT_ICON[ext];
  if (byExt) return byExt;
  if (language && !/^(plain ?text|text)?$/i.test(language)) return FileCode;
  return FileIcon;
}

function FileTypeIcon({ name, language, className = '' }: { name: string; language?: string; className?: string }) {
  const Icon = iconForFile(name, language);
  return <Icon size={14} strokeWidth={1.75} className={`shrink-0 ${className}`} aria-hidden />;
}

// ─── Build Tree ────────────────────────────────────────────────────────

function buildTree(files: StoredFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map(), isDir: true };

  for (const file of files) {
    const groupName = file.repoOrigin
      ? `${file.repoOrigin.owner}/${file.repoOrigin.repo}`
      : '';
    const filePath = file.path || file.name;
    const fullPath = groupName ? `${groupName}/${filePath}` : filePath;
    const parts = fullPath.split('/');

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
          isDir: !isLast,
          repoKey: groupName || undefined,
        });
      }

      const node = current.children.get(part)!;
      if (isLast) {
        node.fileId = file.id;
        node.isDir = false;
      }
      current = node;
    }
  }

  return root;
}

// ─── Shared styles ─────────────────────────────────────────────────────

const ROW =
  'group relative w-full h-[22px] flex items-center gap-1.5 pr-1.5 rounded-[4px] text-[13px] leading-none ' +
  'select-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent/70';
const ROW_IDLE = 'text-fg-secondary hover:bg-white/5 hover:text-fg';
const ROW_ACTIVE = 'bg-white/[0.06] text-fg';
const ROW_ACTION =
  'shrink-0 h-[18px] w-[18px] flex items-center justify-center rounded-[4px] text-fg-muted ' +
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/10 transition-opacity';
const ICON_BTN =
  'h-6 w-6 flex items-center justify-center rounded-ctl text-fg-secondary hover:bg-white/5 hover:text-fg ' +
  'transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent/70';
const SECTION_LABEL = 'text-[11px] font-medium uppercase tracking-wide text-fg-muted';

const indent = (depth: number) => ({ paddingLeft: `${depth * 12 + 6}px` });

/** Activate a role="treeitem" row from the keyboard like a button would. */
const activateOnKey = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

// ─── Context Menu ──────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  fileId: string;
  isInCollab: boolean;
}

function ContextMenu({
  state, onClose, onAddToCollab, onRemoveFromCollab,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onAddToCollab: (fileId: string) => void;
  onRemoveFromCollab: (fileId: string) => void;
  isDark: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const item =
    'w-full h-7 flex items-center gap-2 px-2.5 text-[12px] rounded-[4px] transition-colors outline-none ' +
    'hover:bg-white/5 focus-visible:bg-white/5';

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] min-w-[180px] p-1 rounded-ctl border border-line bg-bg-elevated shadow-subtle text-fg animate-fade-in"
      style={{ left: state.x, top: state.y }}
    >
      {state.isInCollab ? (
        <button
          role="menuitem"
          onClick={() => { onRemoveFromCollab(state.fileId); onClose(); }}
          className={`${item} text-danger`}
        >
          <Minus size={14} /> Remove from Collab
        </button>
      ) : (
        <button
          role="menuitem"
          onClick={() => { onAddToCollab(state.fileId); onClose(); }}
          className={item}
        >
          <Plus size={14} className="text-fg-secondary" /> Add to Collab
        </button>
      )}
    </div>
  );
}

// ─── Tree Node Renderer ───────────────────────────────────────────────

function TreeItem({
  node, depth, activeFileId, loadingFileId, onFileSelect, onFileDelete, onRepoDelete,
  onContextMenu, expandedPaths, toggleExpand, files, isDark, isCollabSection,
  onDragStart, onDragEnd,
}: {
  node: TreeNode; depth: number; activeFileId: string | null; loadingFileId: string | null;
  onFileSelect: (id: string) => void; onFileDelete: (id: string) => void;
  onRepoDelete?: (repoKey: string) => void;
  onContextMenu?: (e: React.MouseEvent, fileId: string, isInCollab: boolean) => void;
  expandedPaths: Set<string>; toggleExpand: (path: string) => void;
  files: StoredFile[]; isDark: boolean; isCollabSection?: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isActive = node.fileId === activeFileId;
  const isLoading = node.fileId === loadingFileId;
  const isRepoRoot = depth === 0 && node.repoKey;

  const storedFile = node.fileId ? files.find(f => f.id === node.fileId) : null;

  if (node.isDir) {
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const Chevron = isExpanded ? ChevronDown : ChevronRight;
    const FolderGlyph = isRepoRoot ? Package : isExpanded ? FolderOpen : Folder;

    return (
      <div>
        <div
          role="treeitem"
          aria-expanded={isExpanded}
          tabIndex={0}
          onClick={() => toggleExpand(node.path)}
          onKeyDown={activateOnKey(() => toggleExpand(node.path))}
          className={`${ROW} ${ROW_IDLE}`}
          style={indent(depth)}
          title={node.path}
        >
          <Chevron size={14} strokeWidth={1.75} className="shrink-0 text-fg-muted" aria-hidden />
          <FolderGlyph size={14} strokeWidth={1.75} className="shrink-0 text-fg-secondary" aria-hidden />
          <span className={`truncate ${isRepoRoot ? 'font-medium text-fg' : ''}`}>
            {node.name}
          </span>
          {isRepoRoot && onRepoDelete && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRepoDelete(node.repoKey!); }}
              className={`${ROW_ACTION} ml-auto hover:text-danger`}
              aria-label={`Remove repository ${node.repoKey}`}
              title="Remove repository"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {isExpanded && sortedChildren.map(child => (
          <TreeItem
            key={child.path} node={child} depth={depth + 1}
            activeFileId={activeFileId} loadingFileId={loadingFileId}
            onFileSelect={onFileSelect} onFileDelete={onFileDelete}
            onRepoDelete={onRepoDelete} onContextMenu={onContextMenu}
            expandedPaths={expandedPaths} toggleExpand={toggleExpand}
            files={files} isDark={isDark} isCollabSection={isCollabSection}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
          />
        ))}
      </div>
    );
  }

  // File node
  const select = () => { if (node.fileId) onFileSelect(node.fileId); };
  return (
    <div
      role="treeitem"
      aria-selected={isActive}
      tabIndex={0}
      onClick={select}
      onKeyDown={activateOnKey(select)}
      onContextMenu={(e) => {
        if (onContextMenu && node.fileId) {
          e.preventDefault();
          onContextMenu(e, node.fileId, !!isCollabSection);
        }
      }}
      draggable
      onDragStart={() => node.fileId && onDragStart(node.fileId)}
      onDragEnd={onDragEnd}
      className={`${ROW} ${isActive ? ROW_ACTIVE : ROW_IDLE}`}
      style={indent(depth)}
      title={node.path}
    >
      {/* spacer aligns file icons with folder icons (chevron width) */}
      <span className="w-[14px] shrink-0" aria-hidden />
      {isLoading
        ? <Loader2 size={14} className="animate-spin text-fg-secondary shrink-0" aria-hidden />
        : <FileTypeIcon name={node.name} language={storedFile?.language} className={isActive ? 'text-fg' : 'text-fg-secondary'} />
      }
      <span className="truncate">{node.name}</span>
      {!isCollabSection && !node.repoKey && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); if (node.fileId) onFileDelete(node.fileId); }}
          className={`${ROW_ACTION} ml-auto hover:text-danger`}
          aria-label={`Delete ${node.name}`}
          title="Delete file"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────

interface FileExplorerProps {
  files: StoredFile[];
  activeFileId: string | null;
  loadingFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileDelete: (id: string) => void;
  onRepoDelete?: (repoKey: string) => void;
  onFileCreate?: (name?: string, content?: string, language?: string) => void;
  triggerNewFile?: number;
  // Collab
  isInRoom: boolean;
  isHost: boolean;
  sharedFiles: SharedFileInfo[];
  collabFileContents: Map<string, StoredFile>;
  onAddToCollab?: (fileId: string) => void;
  onRemoveFromCollab?: (fileId: string) => void;
  onSelectCollabFile?: (fileId: string) => void;
  onReorderCollabFiles?: (newOrder: SharedFileInfo[]) => void;
}

// ─── Main Component ────────────────────────────────────────────────────

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files, activeFileId, loadingFileId, onFileSelect, onFileDelete, onRepoDelete,
  onFileCreate, triggerNewFile,
  isInRoom, isHost, sharedFiles, collabFileContents,
  onAddToCollab, onRemoveFromCollab, onSelectCollabFile, onReorderCollabFiles,
}) => {
  const { isDark } = useTheme();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Inline File Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (triggerNewFile && triggerNewFile > 0) {
      setIsCreating(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [triggerNewFile]);

  const startCreating = () => {
    setIsCreating(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewFileName('');
  };

  const handleCommitNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    const lang = detectLanguage(name, '');
    if (onFileCreate) {
      onFileCreate(name, '', lang);
    }
    setIsCreating(false);
    setNewFileName('');
  };

  // DND State
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isOverCollab, setIsOverCollab] = useState(false);
  const [isOverLocal, setIsOverLocal] = useState(false);

  // Build tree from non-collab files only
  const localFiles = useMemo(() => {
    if (!isInRoom) return files;
    const sharedIds = new Set(sharedFiles.map(f => f.id));
    return files.filter(f => !sharedIds.has(f.id));
  }, [files, isInRoom, sharedFiles]);

  const tree = useMemo(() => buildTree(localFiles), [localFiles]);

  // Auto-expand repo roots
  useMemo(() => {
    const newExpanded = new Set(expandedPaths);
    tree.children.forEach((child) => {
      if (child.isDir && child.repoKey && !expandedPaths.has(child.path)) {
        newExpanded.add(child.path);
      }
    });
    if (newExpanded.size !== expandedPaths.size) {
      setExpandedPaths(newExpanded);
    }
  }, [tree]);

  const sortedChildren = Array.from(tree.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Build collab file tree for the collab section
  const collabFiles = useMemo(() => {
    return sharedFiles.map(sf => {
      const local = collabFileContents.get(sf.id);
      return {
        ...sf,
        storedFile: local || { id: sf.id, name: sf.name, language: sf.language, content: '', contentHash: '', lastModified: Date.now() } as StoredFile,
      };
    });
  }, [sharedFiles, collabFileContents]);

  const dropTarget = 'bg-white/[0.03] ring-1 ring-inset ring-accent/40';

  return (
    <div className="text-[13px] font-sans text-fg-secondary">
      {/* ── Explorer header ─────────────────────────────────────── */}
      <div className="flex items-center h-8 pl-1.5 pr-0.5">
        <span className={SECTION_LABEL}>Explorer</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={startCreating}
            className={ICON_BTN}
            title="Add New File"
            aria-label="New file"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setExpandedPaths(new Set())}
            className={ICON_BTN}
            title="Collapse folders"
            aria-label="Collapse folders"
          >
            <ChevronsDownUp size={14} />
          </button>
        </div>
      </div>

      {/* ── Collab Section ───────────────────────────────────────── */}
      {isInRoom && (
        <div className="mb-2">
          <div className="flex items-center h-[22px] px-1.5">
            <span className={SECTION_LABEL}>Collab</span>
            <span className="ml-auto text-[11px] text-fg-muted tabular-nums">
              {sharedFiles.length} file{sharedFiles.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Collab files / Drop zone */}
          <div
            role="tree"
            aria-label="Shared files"
            className={`relative rounded-[4px] transition-colors min-h-[22px] ${isOverCollab ? dropTarget : ''}`}
            onDragOver={e => {
              e.preventDefault();
              if (draggedFileId && !sharedFiles.some(f => f.id === draggedFileId)) {
                setIsOverCollab(true);
              }
            }}
            onDragLeave={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < rect.left ||
                e.clientX >= rect.right ||
                e.clientY < rect.top ||
                e.clientY >= rect.bottom
              ) {
                setIsOverCollab(false);
              }
            }}
            onDrop={e => {
              e.preventDefault();
              setIsOverCollab(false);
              if (draggedFileId && onAddToCollab && !sharedFiles.some(f => f.id === draggedFileId)) {
                onAddToCollab(draggedFileId);
              }
            }}
          >
            {collabFiles.length === 0 ? (
              <div className="h-[22px] flex items-center px-1.5 text-[12px] text-fg-muted">
                {isOverCollab ? 'Drop to share' : 'No shared files'}
              </div>
            ) : (
              collabFiles.map((cf, index) => {
                const isActive = activeFileId === cf.id;
                const select = () => onSelectCollabFile?.(cf.id);
                return (
                  <div
                    key={cf.id}
                    role="treeitem"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={select}
                    onKeyDown={activateOnKey(select)}
                    onContextMenu={(e) => {
                      if (isHost) {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, fileId: cf.id, isInCollab: true });
                      }
                    }}
                    draggable
                    onDragStart={() => {
                      setDraggedFileId(cf.id);
                      setDraggedIndex(index);
                    }}
                    onDragEnd={() => {
                      setDraggedFileId(null);
                      setDraggedIndex(null);
                      setIsOverCollab(false);
                      setIsOverLocal(false);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedIndex !== null && draggedIndex !== index && isHost) {
                        const newOrder = [...sharedFiles];
                        const [removed] = newOrder.splice(draggedIndex, 1);
                        newOrder.splice(index, 0, removed);
                        onReorderCollabFiles?.(newOrder);
                        setDraggedIndex(index);
                      }
                    }}
                    className={`${ROW} ${isActive ? ROW_ACTIVE : ROW_IDLE}`}
                    style={indent(0)}
                    title={`${cf.name} — shared`}
                  >
                    <span className="w-[14px] shrink-0" aria-hidden />
                    <FileTypeIcon name={cf.name} language={cf.language} className={isActive ? 'text-fg' : 'text-fg-secondary'} />
                    <span className="truncate">{cf.name}</span>
                    <span
                      className="ml-auto mr-1 shrink-0 h-1.5 w-1.5 rounded-full bg-accent"
                      aria-label="Shared"
                      role="img"
                    />
                    {isHost && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onRemoveFromCollab?.(cf.id); }}
                        className={`${ROW_ACTION} hover:text-fg`}
                        title="Remove from collab"
                        aria-label={`Remove ${cf.name} from collab`}
                      >
                        <Minus size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Regular Files Section ────────────────────────────────── */}
      <div>
        {isInRoom && (
          <div className="flex items-center h-[22px] px-1.5">
            <span className={SECTION_LABEL}>My Files</span>
            <span className="ml-auto text-[11px] text-fg-muted tabular-nums">
              {localFiles.length} file{localFiles.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div
          role="tree"
          aria-label="Files"
          className={`relative rounded-[4px] transition-colors min-h-[22px] pb-2 ${isOverLocal ? dropTarget : ''}`}
          onDragOver={e => {
            e.preventDefault();
            if (draggedFileId && sharedFiles.some(f => f.id === draggedFileId)) {
              setIsOverLocal(true);
            }
          }}
          onDragLeave={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX >= rect.right ||
              e.clientY < rect.top ||
              e.clientY >= rect.bottom
            ) {
              setIsOverLocal(false);
            }
          }}
          onDrop={e => {
            e.preventDefault();
            setIsOverLocal(false);
            if (draggedFileId && onRemoveFromCollab && sharedFiles.some(f => f.id === draggedFileId)) {
              onRemoveFromCollab(draggedFileId);
            }
          }}
        >
          {/* Inline New File Creator */}
          {isCreating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCommitNewFile();
              }}
              className="h-[22px] flex items-center gap-1.5 pr-0.5 mb-px rounded-[4px] border border-accent bg-bg"
              style={indent(0)}
            >
              <span className="w-[14px] shrink-0" aria-hidden />
              <FileTypeIcon name={newFileName.trim()} className="text-fg-secondary" />
              <input
                ref={inputRef}
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelCreating();
                }}
                placeholder="filename.ext"
                aria-label="New file name"
                className="flex-1 min-w-0 bg-transparent text-[13px] text-fg placeholder:text-fg-muted outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newFileName.trim()}
                className="shrink-0 h-[18px] w-[18px] flex items-center justify-center rounded-[4px] text-fg-secondary hover:bg-white/10 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Create file (Enter)"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={cancelCreating}
                className="shrink-0 h-[18px] w-[18px] flex items-center justify-center rounded-[4px] text-fg-secondary hover:bg-white/10 hover:text-fg transition-colors"
                title="Cancel (Esc)"
              >
                <X size={12} />
              </button>
            </form>
          )}

          {sortedChildren.length === 0 && !isCreating ? (
            <div className="h-[22px] flex items-center px-1.5 text-[12px] text-fg-muted">
              {isOverLocal ? 'Drop to unshare' : 'No files'}
            </div>
          ) : (
            sortedChildren.map(child => (
              <TreeItem
                key={child.path} node={child} depth={0}
                activeFileId={activeFileId} loadingFileId={loadingFileId}
                onFileSelect={onFileSelect} onFileDelete={onFileDelete}
                onRepoDelete={onRepoDelete}
                onContextMenu={(e, id, collab) => setContextMenu({ x: e.clientX, y: e.clientY, fileId: id, isInCollab: collab })}
                expandedPaths={expandedPaths}
                toggleExpand={path => {
                  const next = new Set(expandedPaths);
                  next.has(path) ? next.delete(path) : next.add(path);
                  setExpandedPaths(next);
                }}
                files={files}
                isDark={isDark}
                onDragStart={setDraggedFileId}
                onDragEnd={() => {
                  setDraggedFileId(null);
                  setIsOverCollab(false);
                  setIsOverLocal(false);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Context Menu ─────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddToCollab={(fileId) => onAddToCollab?.(fileId)}
          onRemoveFromCollab={(fileId) => onRemoveFromCollab?.(fileId)}
          isDark={isDark}
        />
      )}
    </div>
  );
};
