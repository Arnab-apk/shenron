import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Plus, Square, X, Copy, Clipboard, Hand, RotateCw, ChevronDown } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { WorkspaceController } from '../hooks/useWorkspace';
import { CollabProvider } from '../services/collabService';
import { clientId, terminalUrl, TerminalInfo } from '../services/workspaceService';
import { DEFAULT_OPENROUTER_KEY } from '../services/harnessDefaults';

// Shenron dark terminal theme (dark only; isDark kept as an effect dependency for API compatibility)
const TERMINAL_THEME = {background:'#0A0A0F',foreground:'#E6E6EB',cursor:'#56C0F2',cursorAccent:'#0A0A0F',selectionBackground:'#56C0F240',black:'#16161F',brightBlack:'#5C5C6B',white:'#E6E6EB',brightWhite:'#FFFFFF',blue:'#56C0F2',brightBlue:'#7ACFF5',green:'#4ADE80',red:'#F26B6B',yellow:'#F2B66B',cyan:'#6FD6C6',magenta:'#F28FB8'};

export function TerminalPanel({ workspace, room, visible, onHide }: { workspace: WorkspaceController; room: CollabProvider | null; visible: boolean; onHide: () => void }) {
  const { isDark } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const xterm = useRef<XTerm | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const workspaceRef = useRef(workspace); workspaceRef.current = workspace;
  const current = useRef<TerminalInfo | null>(null);
  const ownerRef = useRef('');
  const [terminals,setTerminals] = useState<TerminalInfo[]>([]);
  const [selected,setSelected] = useState<TerminalInfo | null>(null);
  const [connected,setConnected] = useState(false);
  const [error,setError] = useState('');
  const [height,setHeight] = useState(260);
  const drag = useRef<{y:number;height:number} | null>(null);
  const [reconnect,setReconnect] = useState(0);
  const inputQueue = useRef(Promise.resolve());
  const send = (message: unknown) => { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message)); };
  const resize = () => { if (container.current?.offsetWidth && container.current.offsetHeight) { fit.current?.fit(); if(current.current?.owner===ownerRef.current)send({type:'resize',cols:xterm.current?.cols,rows:xterm.current?.rows}); } };
  const create = () => send({type:'create',provider:localStorage.getItem('harness-provider') || 'openrouter',model:localStorage.getItem(`harness-model-${localStorage.getItem('harness-provider') || 'openrouter'}`) || 'nvidia/nemotron-3.5-lightning:free',apiKey:sessionStorage.getItem('harness-openrouter-key') || localStorage.getItem('openrouter-api-key') || DEFAULT_OPENROUTER_KEY});

  useEffect(() => {
    if (!container.current || !workspace.project) return;
    let disposed = false;
    const term = new XTerm({cursorBlink:true,scrollback:5000,fontSize:13,fontFamily:"'JetBrains Mono', Consolas, monospace",allowProposedApi:false,disableStdin:true});
    const addon = new FitAddon(); term.loadAddon(addon); term.open(container.current);
    term.textarea?.setAttribute('aria-label','Workspace terminal input');
    xterm.current = term; fit.current = addon;
    const ws = new WebSocket(terminalUrl()); socket.current = ws;
    const credentials = room?.status === 'connected' ? room.workspaceCredentials : {};
    ws.onopen = () => ws.send(JSON.stringify({type:'authenticate',projectId:workspace.project!.id,clientId:clientId(),...credentials,accessToken:sessionStorage.getItem('harness-access-token') || ''}));
    ws.onmessage = event => {
      if (disposed) return;
      let message; try {message=JSON.parse(event.data);} catch {return;}
      if(message.type==='terminal-list') {
        setConnected(true); ownerRef.current=message.owner; setTerminals(message.terminals); setError('');
        if(message.terminals.length)ws.send(JSON.stringify({type:'attach',id:message.terminals[0].id})); else create();
      } else if(message.type==='attached') {
        current.current=message.terminal; setSelected(message.terminal);
        setTerminals(prev=>[...prev.filter(t=>t.id!==message.terminal.id),message.terminal]);
        term.reset(); term.write(message.buffer); term.options.disableStdin=message.terminal.owner!==ownerRef.current || !message.terminal.alive;
        resize(); if(!term.options.disableStdin)term.focus();
      } else if(message.type==='output' && message.id===current.current?.id)term.write(message.data);
      else if(message.type==='terminal-state') {
        setTerminals(prev=>prev.map(t=>t.id===message.terminal.id?message.terminal:t));
        if(current.current?.id===message.terminal.id) {current.current=message.terminal;setSelected(message.terminal);term.options.disableStdin=message.terminal.owner!==ownerRef.current || !message.terminal.alive;resize();}
      } else if(message.type==='exit')term.writeln(`\r\n[Shell exited: ${message.exitCode}]`);
      else if(message.type==='terminal-closed') {
        setTerminals(prev=>{const next=prev.filter(t=>t.id!==message.id); if(current.current?.id===message.id){current.current=null;setSelected(null);term.reset();if(next.length)ws.send(JSON.stringify({type:'attach',id:next[0].id}));}return next;});
      } else if(message.type==='error')setError(message.message);
    };
    ws.onclose = () => {if(!disposed){setConnected(false);term.options.disableStdin=true;setError('Terminal disconnected. Reconnect to restore the session.');}};
    ws.onerror = () => {if(!disposed)setError('Terminal service is unavailable. Start the local IDE stack.');};
    const subscription = term.onData(data => {
      const id=current.current?.id;
      inputQueue.current=inputQueue.current.then(async()=>{
        if(disposed || !id || current.current?.id!==id || current.current.owner!==ownerRef.current)return;
        await workspaceRef.current.flush();
        if(!disposed && ws.readyState===WebSocket.OPEN && current.current?.id===id)ws.send(JSON.stringify({type:'input',data}));
      }).catch(err=>setError(err.message));
    });
    term.attachCustomKeyEventHandler(event=>{
      if(event.type==='keydown' && event.ctrlKey && event.shiftKey && event.code==='KeyC'){void navigator.clipboard.writeText(term.getSelection()).catch(err=>setError(err.message));return false;}
      if(event.type==='keydown' && event.ctrlKey && event.shiftKey && event.code==='KeyV'){void navigator.clipboard.readText().then(text=>term.paste(text)).catch(err=>setError(err.message));return false;}
      return true;
    });
    const observer=new ResizeObserver(resize);observer.observe(container.current);
    return()=>{disposed=true;observer.disconnect();subscription.dispose();ws.close();term.dispose();socket.current=null;xterm.current=null;fit.current=null;current.current=null;setSelected(null);setConnected(false);};
  },[workspace.project?.id,room,reconnect]);

  useEffect(()=>{if(xterm.current)xterm.current.options.theme=TERMINAL_THEME;},[isDark,workspace.project?.id,reconnect]);
  useEffect(()=>{if(visible)requestAnimationFrame(resize);},[visible,height]);
  const owns=selected?.owner===ownerRef.current;
  const button='inline-flex items-center justify-center gap-1 h-7 min-w-7 rounded-ctl px-1.5 text-[12px] text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none';
  return <section aria-label="Project terminal" style={{height:visible?height:0,display:visible?'flex':'none'}} className="shrink-0 min-h-0 flex-col border-t border-line bg-bg text-fg font-sans">
    <div role="separator" tabIndex={0} aria-label="Resize terminal" aria-orientation="horizontal" aria-valuenow={height} aria-valuemin={160} aria-valuemax={600} className="relative h-px shrink-0 cursor-row-resize bg-line hover:bg-accent focus:outline-none focus-visible:bg-accent before:absolute before:content-[''] before:inset-x-0 before:-top-1 before:-bottom-1"
      onPointerDown={e=>{drag.current={y:e.clientY,height};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setHeight(Math.max(160,Math.min(600,drag.current.height+drag.current.y-e.clientY)));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setHeight(h=>Math.max(160,Math.min(600,h+(e.key==='ArrowUp'?20:-20))));}}} />
    <header className="flex shrink-0 items-center gap-0.5 h-9 border-b border-line bg-bg-panel px-1 overflow-x-auto">
      <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-fg-secondary select-none">Terminal</span>
      <div role="tablist" aria-label="Terminal sessions" className="flex flex-1 self-stretch items-stretch gap-0.5 min-w-0">
        {terminals.map(t=><button role="tab" aria-selected={selected?.id===t.id} key={t.id} className={`relative inline-flex items-center px-2.5 text-[12px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${selected?.id===t.id?'text-fg':'text-fg-secondary hover:text-fg'}`} onClick={()=>send({type:'attach',id:t.id})}>{t.title}{!t.alive?' · exited':''}{selected?.id===t.id&&<span aria-hidden="true" className="absolute inset-x-1.5 bottom-0 h-px bg-accent"/>}</button>)}
      </div>
      <button className={button} disabled={!connected} aria-label="New terminal" onClick={create}><Plus size={14}/></button>
      <button className={button} disabled={!owns||!selected?.alive||!workspace.project?.config.testCommand} onClick={()=>{inputQueue.current=inputQueue.current.then(async()=>{await workspaceRef.current.flush();send({type:'input',data:(workspaceRef.current.project?.config.testCommand || '')+'\r'});}).catch(err=>setError(err.message));}}>Run checks</button>
      <button className={button} disabled={!selected} aria-label="Copy terminal selection" onClick={()=>{void navigator.clipboard.writeText(xterm.current?.getSelection() || '').catch(err=>setError(err.message));}}><Copy size={14}/></button>
      <button className={button} disabled={!owns||!selected?.alive} aria-label="Paste into terminal" onClick={()=>{void navigator.clipboard.readText().then(text=>xterm.current?.paste(text)).catch(err=>setError(err.message));}}><Clipboard size={14}/></button>
      <button className={button} disabled={!owns||!selected?.alive} aria-label="Interrupt terminal command" onClick={()=>send({type:'input',data:'\u0003'})}><Square size={12}/></button>
      <button className={button} disabled={!selected||!!selected.owner&&!owns} onClick={()=>send({type:owns?'release':'claim'})}><Hand size={14}/>{owns?'Release input':'Take control'}</button>
      <button className={button} disabled={!owns} aria-label="Close terminal session" onClick={()=>send({type:'close'})}><X size={14}/></button>
      {!connected&&workspace.project&&<button className={button} aria-label="Reconnect terminal" onClick={()=>setReconnect(n=>n+1)}><RotateCw size={14}/></button>}
      <button className={button} aria-label="Hide terminal panel" title="Hide panel" onClick={onHide}><ChevronDown size={14}/></button>
    </header>
    {workspace.project?<><p className="shrink-0 px-3 py-1 text-[11px] text-fg-muted">{owns?'Input is yours':'View only'} · {selected?.agent?'Shenron agent running':'Type skippy, skippy --resume, or a project command'} · {workspace.project.name}</p><div ref={container} className="min-h-0 flex-1 pl-3 pr-1 pb-1" /></>:<p className="p-4 text-[12px] text-fg-secondary">Save or open a project to start an interactive terminal.</p>}
    {error&&<p role="alert" className="shrink-0 px-3 py-1 text-[12px] text-danger">{error}</p>}
  </section>;
}
