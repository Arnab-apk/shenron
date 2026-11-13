import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Square, Settings, FileCode, Download, Loader2, ShieldAlert } from 'lucide-react';
import { StoredFile } from '../services/storageService';
import { CollabProvider, SharedFileInfo } from '../services/collabService';
import { approveCommand, cancelRun, HarnessEvent, hydrateFiles, loadModels, streamHarness } from '../services/harnessService';
import { DEFAULT_OPENROUTER_KEY } from '../services/harnessDefaults';
import { detectLanguage } from '../utils/detectLanguage';
import { AgentHeader, RoleRow, ToolRow, btnGhost, btnPrimary, btnSecondary, fieldCls, iconBtn } from './agent/ui';
import { ProviderPicker } from './agent/ProviderPicker';

interface Props {
  beginAgent?: () => Promise<() => Promise<void>>;
  activeFile: StoredFile | null;
  allFiles?: StoredFile[];
  onCodeChange?: (id: string, content: string) => void;
  onFileCreate?: () => void;
  onAgentFileCreate?: (path: string, content: string, language?: string) => void;
  provider?: CollabProvider | null;
  sharedFiles?: SharedFileInfo[];
}

export const HarnessPanel: React.FC<Props> = ({ allFiles = [], onAgentFileCreate, provider: room, sharedFiles = [], beginAgent }) => {
  const DEFAULT_KEY = DEFAULT_OPENROUTER_KEY;
  const [provider, setProvider] = useState<'ollama' | 'openrouter'>(() => localStorage.getItem('harness-provider') === 'ollama' ? 'ollama' : 'openrouter');
  const [model, setModel] = useState(() => localStorage.getItem('harness-model-openrouter') || 'nvidia/nemotron-3.5-lightning:free');
  const [models, setModels] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState(() => {
    const key = sessionStorage.getItem('harness-openrouter-key') || localStorage.getItem('openrouter-api-key') || (import.meta as any).env?.VITE_OPENROUTER_API_KEY || DEFAULT_KEY;
    if (key) {
      sessionStorage.setItem('harness-openrouter-key', key);
      localStorage.setItem('openrouter-api-key', key);
    }
    return key;
  });
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('harness-access-token') || '');
  const [settings, setSettings] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [events, setEvents] = useState<HarnessEvent[]>([]);
  const [error, setError] = useState('');
  const [approval, setApproval] = useState('');
  const [conflicts, setConflicts] = useState<HarnessEvent[]>([]);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef<{ id: string; token: string } | null>(null);
  const filesRef = useRef(allFiles);
  filesRef.current = allFiles;
  const bottomRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);

  const append = (event: HarnessEvent) => setEvents(prev => {
    if (event.type === 'status') return [...prev.filter(e => e.type !== 'status'), event].slice(-200);
    if (event.type === 'tool' && event.id && prev.some(e => e.id === event.id)) return prev.map(e => e.id === event.id ? { ...e, ...event } : e);
    return [...prev.filter(e => e.type !== 'status'), event].slice(-200);
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events, approval]);
  useEffect(() => {
    setEvents(room?.agentEvents.map(e => e.event) || []);
    setHistory([]);
    setRemoteBusy(!!room?.agentOwner && room.agentOwner !== room.peerId);
    return room?.onAgentEvent(message => {
      if (message.type === 'agent-event') append(message.event);
      if (message.type === 'agent-owner') setRemoteBusy(!!message.peerId && message.peerId !== room.peerId);
      if (message.type === 'agent-disconnected') { abortRef.current?.abort(); setRemoteBusy(false); }
    });
  }, [room]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (runRef.current) void cancelRun(runRef.current.id, runRef.current.token);
    room?.releaseAgent();
  }, [room]);

  async function refreshModels(selectedProvider = provider) {
    const ticket = ++generation.current;
    setLoadingModels(true); setError('');
    try {
      const data = await loadModels(selectedProvider, apiKey, accessToken);
      if (ticket !== generation.current) return;
      setModels(data.models);
      const saved = localStorage.getItem(`harness-model-${selectedProvider}`);
      const selected = data.models.includes(saved)
        ? saved
        : data.models.find((m: string) => /nemotron/i.test(m)) || data.models[0] || 'nvidia/nemotron-3.5-lightning:free';
      setModel(selected);
      localStorage.setItem(`harness-model-${selectedProvider}`, selected);
    } catch (err: any) { if (ticket === generation.current) setError(err.message); }
    finally { if (ticket === generation.current) setLoadingModels(false); }
  }
  useEffect(() => {
    localStorage.setItem('harness-provider', provider);
    const initialModel = localStorage.getItem(`harness-model-${provider}`) || (provider === 'openrouter' ? 'nvidia/nemotron-3.5-lightning:free' : '');
    setModel(initialModel);
    void refreshModels(provider);
  }, [provider]);

  async function start() {
    if (!prompt.trim() || busy || remoteBusy) return;
    const question = prompt.trim();
    setBusy(true); setError(''); setApproval('');
    const controller = new AbortController(); abortRef.current = controller;
    let claimed = false;
    let finishWorkspace: (() => Promise<void>) | undefined;
    let answer = '';
    const activeRoom = room?.status === 'connected' ? room : null;
    try {
      const chosenModel = model || (provider === 'openrouter' ? 'nvidia/nemotron-3.5-lightning:free' : '');
      if (!chosenModel) throw new Error('Refresh models and select one first.');
      if (activeRoom) { await activeRoom.claimAgent(); claimed = true; }
      if (beginAgent) finishWorkspace = await beginAgent();
      let files: StoredFile[];
      if (activeRoom) {
        await Promise.all(sharedFiles.map(f => activeRoom.openFileConnection(f.id).waitForSync()));
        files = sharedFiles.map(f => ({ ...f, path: f.name, content: activeRoom.openFileConnection(f.id).doc.getText('monaco').toString(), contentHash: '', lastModified: Date.now(), contentLoaded: true }));
      } else files = await hydrateFiles(filesRef.current);
      const paths = files.map(f => f.path || f.name);
      if (new Set(paths).size !== paths.length) throw new Error('Workspace has duplicate file paths. Rename or remove duplicates before using the harness.');
      const baseline = new Map(files.map(f => [f.path || f.name, f.content]));
      setPrompt('');
      const userEvent = { type: 'user', content: question };
      append(userEvent); activeRoom?.publishAgentEvent(userEvent);
      await streamHarness({ provider, model: chosenModel, apiKey: provider === 'openrouter' ? apiKey : '', prompt: question,
        history: history.slice(-10), files: files.map(f => ({ path: f.path || f.name, content: f.content })) }, accessToken, controller.signal, async event => {
        if (event.type === 'started') { runRef.current = { id: event.runId!, token: event.token! }; return; }
        if (event.type === 'approval') { setApproval(event.reason || 'Approve command?'); return; }
        if (event.type === 'file') {
          const path = event.path!;
          try {
            if (activeRoom) {
              await activeRoom.applyAgentEdit(path, event.content!, event.previous ?? null, detectLanguage(path, event.content!) || 'plaintext');
            } else {
              const current = filesRef.current.find(f => (f.path || f.name) === path);
              const currentContent = current?.contentLoaded === false ? baseline.get(path) : current?.content;
              if (currentContent !== (event.previous ?? undefined) && currentContent !== event.content) throw new Error(`Conflict in ${path}: the file changed while the agent was working. Download the proposed edit to review it.`);
              onAgentFileCreate?.(path, event.content!, detectLanguage(path, event.content!));
              // Synchronous ref update handles multiple edits before React's next render.
              filesRef.current = current ? filesRef.current.map(f => f === current ? { ...f, content: event.content!, contentLoaded: true } : f) : [...filesRef.current, { id: path, name: path, path, content: event.content!, language: 'plaintext', contentHash: '', lastModified: Date.now(), contentLoaded: true }];
            }
            baseline.set(path, event.content!);
            append({ type: 'file', path, message: `Updated ${path}` });
          } catch (err: any) {
            setConflicts(prev => [...prev, event]);
            append({ type: 'error', message: err.message });
            activeRoom?.publishAgentEvent({ type: 'error', message: err.message });
            throw new Error('Stopped to protect concurrent edits. Review the proposed file below, then retry.');
          }
          return;
        }
        if (event.type === 'message') answer += (answer ? '\n\n' : '') + event.content;
        if (event.type === 'error') setError(event.message || 'Harness failed.');
        append(event); activeRoom?.publishAgentEvent(event);
      });
      setHistory(prev => [...prev, { role: 'user', content: question } as const, ...(answer ? [{ role: 'assistant', content: answer.slice(-32000) } as const] : [])].slice(-12));
    } catch (err: any) {
      const message = err.name === 'AbortError' ? 'Run stopped. Applied edits are saved.' : err.message;
      setError(message); append({ type: 'error', message }); activeRoom?.publishAgentEvent({ type: 'error', message });
    } finally {
      if (runRef.current) void cancelRun(runRef.current.id, runRef.current.token);
      runRef.current = null; abortRef.current = null;
      try { await finishWorkspace?.(); } catch (error: any) { setError(error.message); }
      if (claimed) activeRoom?.releaseAgent();
      setBusy(false); setApproval('');
    }
  }

  async function decide(approved: boolean) {
    if (!runRef.current) return;
    try { await approveCommand(runRef.current.id, runRef.current.token, approved); setApproval(''); }
    catch (err: any) { setError(err.message); }
  }

  function download(event: HarnessEvent) {
    const url = URL.createObjectURL(new Blob([event.content || ''], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = (event.path || 'proposed.txt').split('/').pop()!; anchor.click(); URL.revokeObjectURL(url);
  }

  const fallbackModels = [
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
  ];
  const modelOptions = (models.length > 0 ? models : fallbackModels).map(m => ({ value: m, label: m }));

  return <section className="flex h-full min-h-0 flex-col bg-bg-panel font-sans text-fg">
    <AgentHeader subtitle={room?.status === 'connected' ? 'Shared workspace' : 'Local workspace'}>
      <button aria-label="Harness settings" title="Harness settings" onClick={() => setSettings(!settings)} className={`${iconBtn} ${settings ? 'bg-white/5 text-fg' : ''}`}><Settings size={14} /></button>
    </AgentHeader>
    <div className="shrink-0 space-y-2 border-b border-line p-3">
      <ProviderPicker
        provider={provider}
        providers={[{ value: 'openrouter', label: 'OpenRouter · cloud' }, { value: 'ollama', label: 'Ollama · local' }]}
        onProviderChange={value => setProvider(value as any)}
        providerDisabled={busy}
        model={model}
        models={modelOptions}
        modelPlaceholder={loadingModels ? 'Loading models…' : 'Select a model'}
        onModelChange={value => { setModel(value); localStorage.setItem(`harness-model-${provider}`, value); }}
        modelDisabled={busy || loadingModels}
        onRefresh={() => void refreshModels()}
        refreshing={loadingModels}
        refreshDisabled={busy || loadingModels}
      />
      {(settings || provider === 'openrouter') && <div className="space-y-2">
        {provider === 'openrouter' && (
          <input
            aria-label="OpenRouter API key"
            type="password"
            placeholder="OpenRouter API key"
            className={fieldCls}
            value={apiKey}
            onChange={e => {
              setApiKey(e.target.value);
              sessionStorage.setItem('harness-openrouter-key', e.target.value);
              localStorage.setItem('openrouter-api-key', e.target.value);
            }}
          />
        )}
        <input aria-label="Server access token" type="password" placeholder="Server access token (for remote access)" className={fieldCls} value={accessToken} onChange={e => { setAccessToken(e.target.value); sessionStorage.setItem('harness-access-token', e.target.value); }} />
        <p className="text-[11px] leading-4 text-fg-muted">Keys stay in this browser session. Nemotron free model works automatically with your OpenRouter key.</p>
      </div>}
    </div>
    <div role="log" aria-label="Harness activity" className="min-h-0 flex-1 overflow-auto">
      {!events.length && <div className="px-3 py-6">
        <Bot size={16} className="mb-2 text-fg-secondary" />
        <p className="text-[13px] font-medium text-fg">Build together with Shenron.</p>
        <p className="mt-1 text-[12px] leading-5 text-fg-secondary">Ask the agent to inspect files, implement a feature, or fix a bug. In a room, both collaborators see its work on shared files.</p>
        <button className={`${btnSecondary} mt-3`} onClick={() => setPrompt('Inspect the workspace and summarize its architecture. Then suggest the most useful next improvement.')}>Explore this project</button>
      </div>}
      {events.map((e, i) => {
        const key = e.id || i;
        if (e.type === 'tool') return <div key={key} className="border-b border-line px-3 py-1.5">
          {e.author && <div className="mb-1 text-[11px] text-fg-muted">{e.author}</div>}
          <ToolRow
            status={e.status === 'running' ? 'running' : e.status === 'failed' ? 'error' : 'ok'}
            name={e.name}
            meta={e.status === 'running' ? 'Working' : e.status === 'failed' ? 'Failed' : 'Done'}
            detail={e.result || e.arguments}
            defaultOpen={e.status === 'running'}
          />
        </div>;
        if (e.type === 'status' || e.type === 'done') return <div key={key} className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px] text-fg-muted">
          {e.type === 'status' && <Loader2 size={14} className="shrink-0 animate-spin" />}
          <span className="min-w-0 whitespace-pre-wrap break-words">{e.content || e.message || (e.type === 'done' ? 'Run complete.' : '')}</span>
        </div>;
        if (e.type === 'file') return <div key={key} className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px] text-fg-secondary">
          <FileCode size={14} className="shrink-0" />
          <span className="min-w-0 break-words font-mono text-[11px]">{e.content || e.message}</span>
          {e.author && <span className="ml-auto shrink-0 text-[11px] text-fg-muted">{e.author}</span>}
        </div>;
        const isUser = e.type === 'user';
        const isError = e.type === 'error';
        return <RoleRow key={key} role={e.author || (isUser ? 'You' : isError ? 'Error' : 'Shenron')} tone={isUser ? 'user' : isError ? 'error' : 'default'}>
          <div className="whitespace-pre-wrap break-words">{e.content || e.message || ''}</div>
        </RoleRow>;
      })}
      {conflicts.length > 0 && <div className="space-y-1 border-b border-line px-3 py-2">
        {conflicts.map((e, i) => <button key={i} onClick={() => download(e)} className={`${btnGhost} text-danger`}><Download size={14} />Download proposed {e.path}</button>)}
      </div>}
      {approval && <div className="border-b border-line px-3 py-2.5">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-fg-secondary"><ShieldAlert size={14} className="text-fg-secondary" />Command approval</div>
        <pre className="mb-1.5 whitespace-pre-wrap break-all rounded-ctl border border-line bg-bg px-2 py-1.5 font-mono text-[11px] text-fg">{approval}</pre>
        <p className="mb-2 text-[11px] text-fg-muted">This command runs on the server with its user's permissions.</p>
        <div className="flex gap-2">
          <button onClick={() => void decide(true)} className={btnPrimary}>Run command</button>
          <button onClick={() => void decide(false)} className={btnSecondary}>Deny</button>
        </div>
      </div>}
      <div ref={bottomRef} />
    </div>
    {error && <p role="alert" className="shrink-0 border-t border-line px-3 py-2 text-[12px] text-danger">{error}</p>}
    {remoteBusy && <p className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2 text-[12px] text-fg-secondary"><Loader2 size={14} className="animate-spin" />Your collaborator is running the harness…</p>}
    <form className="shrink-0 border-t border-line p-3" onSubmit={e => { e.preventDefault(); void start(); }}>
      <textarea aria-label="Ask Shenron" className="min-h-20 w-full resize-none rounded-ctl border border-line bg-bg px-2.5 py-2 text-[13px] leading-5 text-fg outline-none placeholder:text-fg-muted focus:border-accent" placeholder="Ask Shenron to build, fix, or explain…" value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void start(); } }} />
      <div className="mt-2 flex items-center justify-between"><button type="button" disabled={busy || remoteBusy} className={`${btnGhost} -ml-2`} onClick={() => { setHistory([]); setEvents([]); }}>New conversation</button>
        {busy ? <button type="button" onClick={() => { abortRef.current?.abort(); if (runRef.current) void cancelRun(runRef.current.id, runRef.current.token); }} className={`${btnSecondary} text-danger`}><Square size={14} />Stop</button>
        : <button disabled={!prompt.trim() || !model || remoteBusy} className={btnPrimary}><Send size={14} />Run harness</button>}</div>
    </form>
  </section>;
};
