import React, { useState, useEffect, useMemo } from 'react';
import {
  Github, Upload, Loader2, CheckCircle2, AlertCircle,
  ExternalLink, Key, GitBranch, MessageSquare, Files, FileCode, Users, Trash2
} from 'lucide-react';
import { StoredFile } from '../services/storageService';
import {
  pushFilesToGitHub, PushResult, getStoredUser, GitHubUser
} from '../services/githubService';
import { soundEffects } from '../utils/soundEffects';
import { CollabProvider } from '../services/collabService';
import { hydrateFiles } from '../services/harnessService';
import { ModalSurface, modalStyles as ms } from './ModalSurface';

// Separate storage key for push PAT — never shares with OAuth read token
const PUSH_PAT_KEY = 'skiffy-push-pat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  files: StoredFile[];
  activeFile: StoredFile | null;
  isInRoom: boolean;
  provider?: CollabProvider | null;
  sharedFiles?: Array<{ id: string; name: string; language: string }>;
}

type Scope = 'all' | 'collab' | 'active';

const labelWithIcon = 'mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted';

export const GitHubPushModal: React.FC<Props> = ({
  isOpen,
  onClose,
  files,
  activeFile,
  isInRoom,
  sharedFiles = [],
  provider,
}) => {
  // Destination state
  const defaultRepo = useMemo(() => {
    // If active file or any file has repo origin, use that
    const repoFile = files.find(f => f.repoOrigin);
    if (repoFile?.repoOrigin) {
      return `${repoFile.repoOrigin.owner}/${repoFile.repoOrigin.repo}`;
    }
    return '';
  }, [files]);

  const [repoString, setRepoString] = useState(defaultRepo);
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('feat: collaborative updates from Shenron');
  const [scope, setScope] = useState<Scope>(isInRoom && sharedFiles.length > 0 ? 'collab' : 'all');

  // Auth state — uses a dedicated PAT key, never the OAuth read token
  const [token, setToken] = useState(() => localStorage.getItem(PUSH_PAT_KEY) || '');
  const [saveTokenLocally, setSaveTokenLocally] = useState(false);
  const [storedUser, setStoredUser] = useState<GitHubUser | null>(getStoredUser);
  const [tokenOk, setTokenOk] = useState<boolean | null>(null); // null = not validated

  // Execution state
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRepoString(defaultRepo);
      setScope(isInRoom && sharedFiles.length > 0 ? 'collab' : 'all');
      setBranch(activeFile?.repoOrigin?.branch || files.find(f => f.repoOrigin)?.repoOrigin?.branch || 'main');
      setError(null);
      setPushResult(null);
      setPushStatus('');
      setTokenOk(null);
      // Load only the dedicated push PAT, not the OAuth read token
      const savedPat = localStorage.getItem(PUSH_PAT_KEY) || '';
      setToken(savedPat);
      setStoredUser(getStoredUser());
    }
  }, [isOpen, defaultRepo]);

  // Determine files to push based on selected scope
  const filesToPush = useMemo(() => {
    if (scope === 'active') {
      return activeFile ? [{ path: activeFile.path || activeFile.name, content: activeFile.content }] : [];
    }
    if (scope === 'collab' && isInRoom) {
      const sharedIds = new Set(sharedFiles.map(s => s.id));
      const filtered = files.filter(f => sharedIds.has(f.id));
      return filtered.map(f => ({
        path: f.path || f.name,
        content: f.content,
      }));
    }
    // Scope: 'all'
    return files.map(f => ({
      path: f.path || f.name,
      content: f.content,
    }));
  }, [scope, activeFile, isInRoom, sharedFiles, files]);

  const handlePush = async () => {
    setError(null);
    setPushResult(null);

    const trimmedRepo = repoString.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmedRepo)) {
      setError("Please specify the repository as 'owner/repo'.");
      return;
    }

    const [owner, repo] = trimmedRepo.split('/');
    if (!owner || !repo) {
      setError("Invalid repository format. Must be 'owner/repo'.");
      return;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Please provide a GitHub Personal Access Token (PAT) with repo scope.');
      return;
    }

    if (filesToPush.length === 0) {
      setError('No files available to push.');
      return;
    }

    if (saveTokenLocally) {
      // Save under dedicated push-PAT key only
      localStorage.setItem(PUSH_PAT_KEY, trimmedToken);
    }

    setIsPushing(true);
    setPushStatus('Preparing Git tree and commit...');

    try {
      if (provider?.agentOwner) throw new Error('Wait for the harness to finish before pushing.');
      const sharedIds = new Set(sharedFiles.map(f => f.id));
      const selected = scope === 'active' ? (activeFile ? [activeFile] : []) : scope === 'collab' ? files.filter(f => sharedIds.has(f.id)) : files;
      if (provider && isInRoom) await Promise.all(selected.filter(f => sharedIds.has(f.id)).map(f => provider.openFileConnection(f.id).waitForSync()));
      const snapshot = await hydrateFiles(selected.map(f => provider && isInRoom && sharedIds.has(f.id)
        ? { ...f, content: provider.openFileConnection(f.id).doc.getText('monaco').toString(), contentLoaded: true } : f));
      setPushStatus(`Pushing ${filesToPush.length} file(s) to ${owner}/${repo} (${branch})...`);
      const res = await pushFilesToGitHub({
        owner,
        repo,
        branch: branch.trim() || 'main',
        message: commitMessage.trim() || 'feat: updates from Shenron',
        files: snapshot.map(f => ({ path: f.path || f.name, content: f.content })),
        token: trimmedToken,
      });

      setPushResult(res);
      soundEffects.success();
    } catch (err: any) {
      setError(err.message || 'Failed to push to GitHub');
      soundEffects.error?.();
    } finally {
      setIsPushing(false);
      setPushStatus('');
    }
  };

  const scopeBtn = (active: boolean) =>
    `flex min-w-0 flex-col items-start justify-center gap-0.5 rounded-ctl border px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
      active
        ? 'border-accent bg-[#56C0F2]/10 text-fg'
        : 'border-line bg-bg-elevated text-fg-secondary hover:border-line-hover hover:text-fg'
    }`;

  const footer = (
    <>
      <button type="button" onClick={onClose} disabled={isPushing} className={ms.btnSecondary}>
        Close
      </button>
      <button
        type="button"
        onClick={handlePush}
        disabled={isPushing || filesToPush.length === 0}
        className={ms.btnPrimary}
      >
        {isPushing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Pushing...
          </>
        ) : (
          <>
            <Upload size={14} />
            Commit & Push
          </>
        )}
      </button>
    </>
  );

  return (
    <ModalSurface
      isOpen={isOpen}
      onClose={onClose}
      icon={<Github size={16} />}
      title={
        <>
          Push to GitHub
          {isInRoom && (
            <span className="inline-flex h-5 items-center gap-1 rounded-ctl border border-line bg-bg-elevated px-1.5 text-[11px] font-medium text-fg-secondary">
              <Users size={11} className="text-success" /> Collab session
            </span>
          )}
        </>
      }
      ariaLabel="Push to GitHub"
      subtitle="Commit and push your code directly to a GitHub repository."
      footer={footer}
      footerStart={pushStatus || (isPushing ? 'Working...' : `Ready to push ${filesToPush.length} files`)}
      width={520}
    >
      <div className="space-y-3">
        {/* Success Banner */}
        {pushResult && (
          <div className={`${ms.success} flex-col gap-1`}>
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Successfully pushed {pushResult.filesPushed} file(s)!</span>
            </div>
            <p className="text-fg-secondary">
              Commit SHA: <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px] text-fg">{pushResult.commitSha.slice(0, 7)}</code>
            </p>
            <a
              href={pushResult.commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              View commit on GitHub <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div role="alert" className={ms.error}>
            <AlertCircle size={14} className="mt-px shrink-0" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Destination Repo & Branch */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="gh-push-repo" className={labelWithIcon}>
              <Github size={12} /> Repository
            </label>
            <input
              id="gh-push-repo"
              type="text"
              value={repoString}
              onChange={e => setRepoString(e.target.value)}
              placeholder="owner/repo"
              className={`${ms.input} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="gh-push-branch" className={labelWithIcon}>
              <GitBranch size={12} /> Branch
            </label>
            <input
              id="gh-push-branch"
              type="text"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="main"
              className={`${ms.input} font-mono`}
            />
          </div>
        </div>

        {/* Commit Message */}
        <div>
          <label htmlFor="gh-push-message" className={labelWithIcon}>
            <MessageSquare size={12} /> Commit message
          </label>
          <input
            id="gh-push-message"
            type="text"
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder="feat: collaborative updates from Shenron"
            className={ms.input}
          />
        </div>

        {/* Scope Selector */}
        <div>
          <span className={labelWithIcon}>
            <Files size={12} /> Files to include ({filesToPush.length})
          </span>
          <div className={`grid gap-2 ${isInRoom ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button type="button" onClick={() => setScope('all')} aria-pressed={scope === 'all'} className={scopeBtn(scope === 'all')}>
              <span>All Workspace</span>
              <span className="text-[11px] font-normal text-fg-muted">{files.length} files</span>
            </button>

            {isInRoom && (
              <button type="button" onClick={() => setScope('collab')} aria-pressed={scope === 'collab'} className={scopeBtn(scope === 'collab')}>
                <span>Collab Shared</span>
                <span className="text-[11px] font-normal text-fg-muted">{sharedFiles.length} files</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setScope('active')}
              disabled={!activeFile}
              aria-pressed={scope === 'active'}
              className={scopeBtn(scope === 'active')}
            >
              <span>Active File</span>
              <span className="w-full truncate text-[11px] font-normal text-fg-muted">{activeFile ? activeFile.name : 'None'}</span>
            </button>
          </div>

          {/* File List Chips */}
          <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-ctl border border-line bg-bg p-1.5 custom-scrollbar">
            {filesToPush.length === 0 && <span className="px-1 text-[12px] text-fg-muted">No files selected</span>}
            {filesToPush.map((f, i) => (
              <span
                key={i}
                className="inline-flex h-5 items-center gap-1 rounded border border-line bg-bg-elevated px-1.5 font-mono text-[11px] text-fg-secondary"
              >
                <FileCode size={11} className="shrink-0 text-fg-muted" />
                <span className="max-w-[140px] truncate">{f.path}</span>
              </span>
            ))}
          </div>
        </div>

        {/* GitHub Auth Token */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="gh-push-token" className={labelWithIcon}>
              <Key size={12} /> Personal access token
            </label>
            {storedUser && (
              <span className="mb-1 text-[11px] text-fg-secondary">
                Logged in as @{storedUser.login}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              id="gh-push-token"
              type="password"
              value={token}
              onChange={e => { setToken(e.target.value); setTokenOk(null); setError(null); }}
              placeholder="ghp_... or github_pat_..."
              className={`${ms.input} pr-8 font-mono ${tokenOk === false ? 'border-danger' : ''}`}
            />
            {token && (
              <button
                type="button"
                onClick={() => { setToken(''); setTokenOk(null); localStorage.removeItem(PUSH_PAT_KEY); }}
                title="Clear saved token"
                aria-label="Clear saved token"
                className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-ctl text-fg-muted transition-colors hover:bg-white/5 hover:text-danger"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Token hint */}
          <p className="mt-1.5 text-[11px] leading-4 text-fg-muted">
            Requires a PAT with <code className="font-mono text-fg-secondary">repo</code> scope. This is
            {' '}<em>different</em> from your GitHub login — it won't pick up the Import OAuth token automatically.
          </p>

          <div className="mt-2 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-fg-secondary hover:text-fg">
              <input
                type="checkbox"
                checked={saveTokenLocally}
                onChange={e => setSaveTokenLocally(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line bg-bg accent-[#56C0F2]"
              />
              Remember token on this device
            </label>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-accent hover:underline"
            >
              Generate token <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>
    </ModalSurface>
  );
};
