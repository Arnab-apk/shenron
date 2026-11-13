import React, { useState, useEffect, useCallback } from 'react';
import {
  Github, Link2, Loader2, ArrowLeft, Download,
  FolderOpen, FileCode, Lock, Globe, ChevronRight, LogOut, AlertCircle, Check, Search
} from 'lucide-react';
import {
  getStoredToken, storeToken, clearToken, startOAuthPopup, fetchGitHubUser,
  getStoredUser, storeUser, listRepos, getRepoContents,
  fetchFileContent, fetchFromPublicUrl, parseGitHubUrl, fetchRepoTree,
  GitHubUser, GitHubRepo, GitHubContent, RepoTreeItem
} from '../services/githubService';
import { detectLanguageAI } from '../utils/detectLanguage';
import { ModalSurface, modalStyles as ms } from './ModalSurface';

type Tab = 'url' | 'connect';
type BrowseView = 'auth' | 'repos' | 'files';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (fileName: string, content: string, language: string) => void;
  onImportRepo?: (repo: GitHubRepo, tree: RepoTreeItem[]) => void;
}

const rowBtn =
  'group flex w-full items-center justify-between gap-2 rounded-ctl px-2 py-1.5 text-left transition-colors hover:bg-white/5 disabled:opacity-60';

export const GitHubImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, onImportRepo }) => {
  const [tab, setTab] = useState<Tab>('url');

  // URL tab state
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [urlSuccess, setUrlSuccess] = useState('');

  // Connect tab state
  const [browseView, setBrowseView] = useState<BrowseView>('auth');

  const [user, setUser] = useState<GitHubUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Repo browser
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  // File browser
  const [contents, setContents] = useState<GitHubContent[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [importingFile, setImportingFile] = useState<string | null>(null);
  const [importingRepo, setImportingRepo] = useState(false);

  // Init: check stored token
  useEffect(() => {
    if (isOpen) {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      if (storedToken && storedUser) {
        setUser(storedUser);
        setBrowseView('repos');
      } else {
        setBrowseView('auth');
      }
    }
  }, [isOpen]);

  // Load repos when entering repos view
  useEffect(() => {
    if (browseView === 'repos' && user) loadRepos();
  }, [browseView, user]);

  const loadRepos = async () => {
    const t = getStoredToken();
    if (!t) return;
    setReposLoading(true);
    try {
      const data = await listRepos(t, 1, 100);
      setRepos(data);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setReposLoading(false);
    }
  };

  const handleConnect = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const accessToken = await startOAuthPopup();
      const ghUser = await fetchGitHubUser(accessToken);
      storeToken(accessToken);
      storeUser(ghUser);
      setUser(ghUser);
      setBrowseView('repos');
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearToken();
    setUser(null);
    setRepos([]);
    setSelectedRepo(null);
    setContents([]);
    setCurrentPath('');
    setPathHistory([]);
    setBrowseView('auth');
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setCurrentPath('');
    setPathHistory([]);
    setBrowseView('files');
    await loadContents(repo.owner.login, repo.name, '');
  };

  const loadContents = async (owner: string, repo: string, path: string) => {
    const t = getStoredToken();
    if (!t) return;
    setFilesLoading(true);
    setFilesError('');
    try {
      const data = await getRepoContents(t, owner, repo, path);
      // Sort: dirs first, then files
      data.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setContents(data);
    } catch (e: any) {
      setFilesError(e.message);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleNavigateDir = async (dirPath: string) => {
    if (!selectedRepo) return;
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(dirPath);
    await loadContents(selectedRepo.owner.login, selectedRepo.name, dirPath);
  };

  const handleGoBack = async () => {
    if (!selectedRepo) return;
    if (pathHistory.length === 0) {
      setBrowseView('repos');
      setSelectedRepo(null);
      return;
    }
    const prev = pathHistory[pathHistory.length - 1];
    setPathHistory(h => h.slice(0, -1));
    setCurrentPath(prev);
    await loadContents(selectedRepo.owner.login, selectedRepo.name, prev);
  };

  const handleImportFile = async (item: GitHubContent) => {
    if (!item.download_url) return;
    setImportingFile(item.path);
    try {
      const t = getStoredToken();
      const content = await fetchFileContent(item.download_url, t);
      const lang = await detectLanguageAI(item.name, content);
      onImport(item.name, content, lang);
      onClose();
    } catch (e: any) {
      setFilesError(e.message);
    } finally {
      setImportingFile(null);
    }
  };

  const handleImportRepo = async () => {
    const t = getStoredToken();
    if (!t || !selectedRepo || !onImportRepo) return;
    setImportingRepo(true);
    try {
      const data = await fetchRepoTree(t, selectedRepo.owner.login, selectedRepo.name, selectedRepo.default_branch);
      onImportRepo(selectedRepo, data.tree);
      onClose();
    } catch (e: any) {
      setFilesError(e.message);
    } finally {
      setImportingRepo(false);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    if (!parseGitHubUrl(url.trim())) {
      setUrlError('Invalid GitHub URL. Use a github.com/…/blob/… or raw.githubusercontent.com/… link.');
      return;
    }
    setUrlLoading(true);
    setUrlError('');
    setUrlSuccess('');
    try {
      const { fileName, content } = await fetchFromPublicUrl(url.trim());
      const lang = await detectLanguageAI(fileName, content);
      setUrlSuccess(`Imported "${fileName}" successfully!`);
      onImport(fileName, content, lang);
      setTimeout(() => { onClose(); setUrl(''); setUrlSuccess(''); }, 800);
    } catch (e: any) {
      setUrlError(e.message);
    } finally {
      setUrlLoading(false);
    }
  };

  const filteredRepos = repoSearch
    ? repos.filter(r => r.name.toLowerCase().includes(repoSearch.toLowerCase()) || r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
    : repos;

  const resetAndClose = useCallback(() => {
    setUrl(''); setUrlError(''); setUrlSuccess('');
    setAuthError(''); setFilesError('');
    onClose();
  }, [onClose]);

  const tabs = (
    <div className="flex px-1">
      {([['url', Link2, 'Paste URL'] as const, ['connect', Github, 'Connect GitHub'] as const]).map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setTab(key)}
          aria-pressed={tab === key}
          className={ms.tab(tab === key)}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );

  const footer = (
    <>
      <button type="button" onClick={resetAndClose} className={ms.btnSecondary}>
        Cancel
      </button>
      {tab === 'url' && (
        <button type="button" onClick={handleUrlImport} disabled={urlLoading || !url.trim()} className={ms.btnPrimary}>
          {urlLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {urlLoading ? 'Importing...' : 'Import File'}
        </button>
      )}
    </>
  );

  const spinner = (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={18} className="animate-spin text-fg-secondary" />
    </div>
  );

  return (
    <ModalSurface
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Import from GitHub"
      subtitle="Paste a link or browse your repositories."
      icon={<Github size={16} />}
      toolbar={tabs}
      footer={footer}
      width={560}
      bodyClassName="h-[420px] p-0"
    >
      {/* ── URL Tab ────────────────────────────────── */}
      {tab === 'url' && (
        <div className="space-y-3 p-3">
          <div>
            <label htmlFor="gh-import-url" className={ms.label}>File URL</label>
            <input
              id="gh-import-url"
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); setUrlSuccess(''); }}
              onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
              placeholder="https://github.com/owner/repo/blob/main/file.ts"
              className={`${ms.input} font-mono`}
              autoFocus
            />
            <p className="mt-1.5 text-[12px] text-fg-muted">
              Paste a public GitHub file link to import it directly into the editor.
            </p>
          </div>
          {urlError && (
            <div role="alert" className={ms.error}>
              <AlertCircle size={14} className="mt-px shrink-0" /><span>{urlError}</span>
            </div>
          )}
          {urlSuccess && (
            <div className={ms.success}>
              <Check size={14} className="mt-px shrink-0" /><span>{urlSuccess}</span>
            </div>
          )}
          <div className="space-y-1">
            <span className={ms.label}>Supported formats</span>
            <code className="block rounded-ctl border border-line bg-bg px-2.5 py-1.5 font-mono text-[11px] text-fg-secondary">
              github.com/owner/repo/blob/branch/path/file.ext
            </code>
            <code className="block rounded-ctl border border-line bg-bg px-2.5 py-1.5 font-mono text-[11px] text-fg-secondary">
              raw.githubusercontent.com/owner/repo/branch/path/file.ext
            </code>
          </div>
        </div>
      )}

      {/* ── Connect Tab (OAuth) ─────────────────── */}
      {tab === 'connect' && browseView === 'auth' && (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-bg-elevated">
            <Github size={18} className="text-fg-secondary" />
          </div>
          <h3 className="text-[13px] font-semibold text-fg">Connect your GitHub account</h3>
          <p className="mt-1 max-w-[340px] text-[12px] text-fg-muted">
            Sign in with GitHub to browse and import files from all your repositories — including private ones.
          </p>
          {/* Auth error — slides in above the button */}
          <div
            className="w-full max-w-[340px] overflow-hidden transition-all duration-300 ease-out"
            style={{ maxHeight: authError ? '72px' : '0px', opacity: authError ? 1 : 0 }}
          >
            <div role={authError ? 'alert' : undefined} className={`${ms.error} mt-3 text-left`}>
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span className="leading-snug">{authError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={authLoading}
            key={authError ? `err-${authError}` : 'idle'}
            className={`${ms.btnPrimary} mt-4 ${authError ? 'animate-shake' : ''}`}
          >
            {authLoading ? (
              <><Loader2 size={14} className="animate-spin" /> Authenticating…</>
            ) : (
              <><Github size={14} /> Sign in with GitHub</>
            )}
          </button>
        </div>
      )}

      {/* ── Repos View ────────────────────────────── */}
      {tab === 'connect' && browseView === 'repos' && (
        <div className="flex h-full flex-col">
          {/* User bar */}
          {user && (
            <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <img src={user.avatar_url} alt="" className="h-5 w-5 rounded-full border border-line" />
                <span className="truncate text-[12px] font-medium text-fg">{user.name || user.login}</span>
                <span className="truncate text-[12px] text-fg-muted">@{user.login}</span>
              </div>
              <button type="button" onClick={handleDisconnect} className={`${ms.btnGhost} hover:text-danger`}>
                <LogOut size={13} /> Disconnect
              </button>
            </div>
          )}
          {/* Search */}
          <div className="shrink-0 px-3 py-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                value={repoSearch}
                onChange={e => setRepoSearch(e.target.value)}
                placeholder="Search repositories..."
                aria-label="Search repositories"
                className={`${ms.input} pl-8`}
              />
            </div>
          </div>
          {/* List */}
          <div className="min-h-0 flex-1 space-y-px overflow-y-auto px-2 pb-2 custom-scrollbar">
            {reposLoading ? spinner : filteredRepos.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-fg-muted">No repositories found.</div>
            ) : (
              filteredRepos.map(repo => (
                <button key={repo.id} type="button" onClick={() => handleSelectRepo(repo)} className={rowBtn}>
                  <div className="flex min-w-0 items-center gap-2">
                    {repo.private
                      ? <Lock size={14} className="shrink-0 text-fg-secondary" />
                      : <Globe size={14} className="shrink-0 text-fg-muted" />}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-fg">{repo.name}</div>
                      {repo.description && <div className="truncate text-[11px] text-fg-muted">{repo.description}</div>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {repo.language && (
                      <span className="rounded border border-line px-1.5 py-px text-[11px] text-fg-secondary">
                        {repo.language}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-fg-muted transition-colors group-hover:text-fg" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Files View ────────────────────────────── */}
      {tab === 'connect' && browseView === 'files' && selectedRepo && (
        <div className="flex h-full flex-col">
          {/* Breadcrumb + Import Repo */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Back"
                title="Back"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ctl text-fg-secondary transition-colors hover:bg-white/5 hover:text-fg"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="flex min-w-0 items-center gap-1 text-[12px]">
                <span className="shrink-0 font-medium text-fg">{selectedRepo.name}</span>
                {currentPath && (
                  <>
                    <span className="text-fg-muted">/</span>
                    <span className="truncate font-mono text-[11px] text-fg-secondary">{currentPath}</span>
                  </>
                )}
              </div>
            </div>
            {onImportRepo && !currentPath && (
              <button
                type="button"
                onClick={handleImportRepo}
                disabled={importingRepo}
                className={`${ms.btnPrimary} h-7 shrink-0`}
              >
                {importingRepo ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {importingRepo ? 'Importing…' : 'Import Repo'}
              </button>
            )}
          </div>
          {/* File list */}
          <div className="min-h-0 flex-1 space-y-px overflow-y-auto px-2 py-1.5 custom-scrollbar">
            {filesLoading ? spinner : filesError ? (
              <div role="alert" className={`${ms.error} m-1`}>
                <AlertCircle size={14} className="mt-px shrink-0" />{filesError}
              </div>
            ) : (
              contents.map(item => (
                <button
                  key={item.sha}
                  type="button"
                  onClick={() => item.type === 'dir' ? handleNavigateDir(item.path) : handleImportFile(item)}
                  disabled={importingFile === item.path}
                  className={rowBtn}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.type === 'dir'
                      ? <FolderOpen size={14} className="shrink-0 text-fg-secondary" />
                      : <FileCode size={14} className="shrink-0 text-fg-muted" />}
                    <span className="truncate text-[13px] text-fg">{item.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {importingFile === item.path ? (
                      <Loader2 size={14} className="animate-spin text-fg-secondary" />
                    ) : item.type === 'dir' ? (
                      <ChevronRight size={14} className="text-fg-muted transition-colors group-hover:text-fg" />
                    ) : (
                      <span className="text-[11px] text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        Import
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </ModalSurface>
  );
};
