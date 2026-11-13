import { useEffect, useRef, useState } from 'react';
import { CheckpointDiff } from './CheckpointDiff';
import { FolderOpen, Save, History, X, Upload, RotateCcw } from 'lucide-react';
import { WorkspaceController } from '../hooks/useWorkspace';
import { CollabProvider } from '../services/collabService';
import { FileDiff, workspaceRequest } from '../services/workspaceService';
import { useTheme } from '../hooks/useTheme';

export function WorkspaceBar({workspace,room}:{workspace:WorkspaceController;room:CollabProvider|null}) {
  const {isDark}=useTheme();
  const dialog=useRef<HTMLDialogElement>(null);
  const [mode,setMode]=useState<'create'|'review'|null>(null);
  const [name,setName]=useState('My project');
  const [includeFiles,setIncludeFiles]=useState(true);
  const [checkpointId,setCheckpointId]=useState('');
  const [diffs,setDiffs]=useState<FileDiff[]>([]);
  const [diffIndex,setDiffIndex]=useState(0);
  const [loading,setLoading]=useState(false);
  const [confirmRestore,setConfirmRestore]=useState(false);
  const [label,setLabel]=useState('');
  const [testCommand,setTestCommand]=useState(workspace.project?.config.testCommand || '');
  useEffect(()=>setTestCommand(workspace.project?.config.testCommand || ''),[workspace.project?.id,workspace.project?.config.testCommand]);
  const [notice,setNotice]=useState('');
  const folderInput=useRef<HTMLInputElement>(null);
  const host=!room||room.status!=='connected'||room.isHost;
  const button='inline-flex items-center gap-1.5 h-7 rounded-ctl border border-line bg-bg-elevated px-2.5 text-[12px] font-medium text-fg hover:border-line-hover transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none [&>svg]:text-fg-secondary';
  const primary='inline-flex items-center gap-1.5 h-8 rounded-ctl bg-accent hover:bg-accent-hover px-3 text-[12px] font-medium text-[#0A0A0F] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-elevated disabled:opacity-40 disabled:pointer-events-none';
  const ghost='inline-flex items-center justify-center w-7 h-7 rounded-ctl text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent';
  const field='h-8 rounded-ctl border border-line bg-bg px-2 text-[12px] text-fg placeholder:text-fg-muted transition-colors focus:outline-none focus:border-accent disabled:opacity-50';
  const act=async(fn:()=>Promise<unknown>)=>{setLoading(true);workspace.setError('');try{await fn();}catch(error){workspace.setError((error as Error).message);}finally{setLoading(false);}};
  const close=()=>{dialog.current?.close();setMode(null);setConfirmRestore(false);};
  useEffect(()=>{if(mode)dialog.current?.showModal();},[mode]);
  useEffect(()=>{
    if(mode!=='review'||!checkpointId||!workspace.project)return;
    let cancelled=false;
    setDiffs([]);setDiffIndex(0);setConfirmRestore(false);setLoading(true);
    void workspace.flush().then(()=>workspaceRequest<{files:FileDiff[]}>(`/projects/${workspace.project!.id}/checkpoints/${checkpointId}/diff`,room)).then(data=>{if(!cancelled)setDiffs(data.files);}).catch(error=>{if(!cancelled)workspace.setError(error.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[mode,checkpointId,workspace.project?.id]);
  const selected=diffs[diffIndex];
  return <>
    <section aria-label="Project workspace" className="min-w-0 py-2 pr-2 text-fg font-sans">
      <div className="flex items-center gap-1.5 flex-wrap min-h-7">
        <FolderOpen size={14} className="text-fg-secondary shrink-0"/>
        <select aria-label="Saved project" value={workspace.project?.id||''} disabled={workspace.busy||loading||!host||workspace.project?.agentBusy} className={`${field} h-7 max-w-52`} onFocus={()=>{void workspace.refreshProjects().catch(error=>workspace.setError(error.message));}} onChange={e=>{if(e.target.value)void act(()=>workspace.open(e.target.value));}}>
          <option value="">Browser files · save a project</option>
          {workspace.projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <button className={button} disabled={workspace.busy||loading||!host||workspace.project?.agentBusy} onClick={()=>setMode('create')}><Save size={13}/>{workspace.project?'New project':'Save project'}</button>
        <button className={button} disabled={workspace.busy||loading||!host||workspace.project?.agentBusy} onClick={()=>folderInput.current?.click()}><Upload size={13}/>Import folder</button>
        <input ref={folderInput} type="file" multiple {...({webkitdirectory:'',directory:''} as any)} className="hidden" aria-label="Import project folder" onChange={e=>{
          const imported=Array.from(e.target.files||[]);e.target.value='';if(!imported.length)return;
          void act(async()=>{
            const seed:Array<{path:string;content:string}>=[];let skipped=0;
            for(const file of imported){const relative=file.webkitRelativePath.split('/').slice(1).join('/');if(!relative||/(^|\/)(node_modules|\.git|\.venv|venv|dist|build|__pycache__|\.skippy)(\/|$)/.test(relative)||file.size>1_000_000){skipped++;continue;}try{const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.includes(0))throw new Error('Binary');seed.push({path:relative,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes)});}catch{skipped++;}}
            await workspace.create(imported[0].webkitRelativePath.split('/')[0]||'Imported project',seed);
            setNotice(`Imported ${seed.length} text files${skipped?`; skipped ${skipped} binary, large, or generated files`:''}.`);
          });
        }}/>
        <button className={button} disabled={!workspace.project||loading||workspace.busy} aria-label="Save project files" onClick={()=>void act(workspace.flush)}><Save size={13}/><span className="hidden sm:inline">Save</span></button>
        <button className={button} disabled={!workspace.project||loading||workspace.busy||workspace.project.agentBusy} onClick={()=>void act(()=>workspace.checkpoint('Checkpoint '+new Date().toLocaleString()))}><History size={13}/>Checkpoint</button>
        <button className={button} disabled={!workspace.project||loading} onClick={()=>{setCheckpointId(workspace.checkpoints[0]?.id||'');setMode('review');}}><History size={13}/>Review changes</button>
        <span role="status" className="ml-auto pl-2 text-[11px] text-fg-muted truncate">{workspace.busy?'Opening project…':workspace.status}{workspace.project?.agentBusy?' · Shenron agent active':''}</span>
      </div>
      {notice&&<p className="mt-1.5 text-[12px] text-fg-secondary">{notice}<button className="ml-2 text-fg-muted underline hover:text-fg" onClick={()=>setNotice('')}>Dismiss</button></p>}
      {workspace.error&&<p role="alert" className="mt-1.5 text-[12px] text-danger">{workspace.error}<button className="ml-2 text-fg-muted underline hover:text-fg" onClick={()=>workspace.setError('')}>Dismiss</button></p>}
      {workspace.conflicts.map(conflict=><div key={conflict.path} className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#F2B66B]"><span>Conflict: {conflict.path}</span><button className={button} onClick={()=>void act(()=>workspace.resolveConflict(conflict.path,true))}>Use disk version</button><button className={button} onClick={()=>void act(()=>workspace.resolveConflict(conflict.path,false))}>Keep editor version</button></div>)}
    </section>
    <dialog ref={dialog} onCancel={()=>{setMode(null);setConfirmRestore(false);}} onClose={()=>setMode(null)} className="w-[min(1000px,94vw)] max-h-[90dvh] rounded-panel p-0 border border-line bg-bg-elevated text-fg font-sans shadow-subtle backdrop:bg-black/60" aria-label={mode==='create'?'Save a project':'Review project changes'}>
      <header className="flex items-center justify-between h-11 border-b border-line pl-4 pr-2"><h2 className="text-[13px] font-semibold">{mode==='create'?'Save a project':'Checkpoints and changes'}</h2><button aria-label="Close workspace dialog" className={ghost} onClick={close}><X size={16}/></button></header>
      {workspace.error&&<p role="alert" className="px-4 pt-3 text-[12px] text-danger">{workspace.error}</p>}
      {mode==='create'?<form className="space-y-3 p-4" onSubmit={e=>{e.preventDefault();void act(async()=>{await workspace.create(name,includeFiles?undefined:[]);close();});}}>
        <label className="block text-[12px] text-fg-secondary">Project name<input autoFocus required maxLength={100} className={`${field} mt-1 block w-full`} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="flex items-center gap-2 text-[12px] text-fg-secondary"><input type="checkbox" className="accent-[#56C0F2]" checked={includeFiles} onChange={e=>setIncludeFiles(e.target.checked)}/>Include current editor files</label>
        <p className="text-[12px] text-fg-muted">The editor, terminal, and the Shenron agent will use the same saved files on this IDE server.</p>
        <button disabled={loading||!name.trim()} className={primary}>{loading?'Saving…':'Save and open project'}</button>
      </form>:<div className="p-4 space-y-3 overflow-y-auto">
        <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();void act(()=>workspace.configure(testCommand));}}><label className="flex-1 text-[12px] text-fg-secondary">Project test command<input aria-label="Project test command" className={`${field} mt-1 w-full`} placeholder="npm test, pytest, or your project’s check command" value={testCommand} maxLength={1000} onChange={e=>setTestCommand(e.target.value)}/></label><button className={button} disabled={loading||!host}>Save command</button></form>
        <p className="text-[12px] text-fg-muted">Shenron creates a checkpoint before each run. Review file changes or restore a saved state.</p>
        <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void act(()=>workspace.checkpoint(label.trim()||'Checkpoint'));setLabel('');}}><input aria-label="Checkpoint label" className={`${field} flex-1 min-w-40`} placeholder="Checkpoint label" value={label} onChange={e=>setLabel(e.target.value)}/><button className={button} disabled={loading||workspace.project?.agentBusy}>Create checkpoint</button></form>
        <label className="block text-[12px] text-fg-secondary">Compare current files with<select aria-label="Checkpoint to review" className={`${field} mt-1 w-full`} value={checkpointId} onChange={e=>setCheckpointId(e.target.value)}><option value="">Select checkpoint</option>{workspace.checkpoints.map(checkpoint=><option key={checkpoint.id} value={checkpoint.id}>{checkpoint.label} · {new Date(checkpoint.createdAt).toLocaleString()}</option>)}</select></label>
        {loading?<p role="status" className="text-[12px] text-fg-secondary">Loading changes…</p>:checkpointId&&<><p className="text-[12px] text-fg-muted">{diffs.length} changed files</p>{!!diffs.length&&<><select aria-label="Changed file" className={`${field} w-full`} value={diffIndex} onChange={e=>setDiffIndex(Number(e.target.value))}>{diffs.map((diff,index)=><option key={diff.path} value={index}>{diff.status} · {diff.path}</option>)}</select>{selected?.binary?<p className="p-4 text-[12px] text-fg-secondary">Binary or large file changed. Its contents are included in checkpoint recovery.</p>:selected&&<CheckpointDiff diff={selected} isDark={isDark}/>}</>}
          {confirmRestore?<div className="rounded-ctl border border-[#F2B66B]/40 bg-bg p-3 space-y-3"><p className="text-[12px] text-fg">Restore this checkpoint’s project files? Close all terminal sessions first. A recovery checkpoint preserves the current files.</p><div className="flex gap-2"><button className={button} onClick={()=>void act(async()=>{await workspace.restore(checkpointId);close();})}>Restore checkpoint</button><button className={button} onClick={()=>setConfirmRestore(false)}>Cancel</button></div></div>:<button disabled={workspace.project?.agentBusy||loading||!host} className={button} onClick={()=>setConfirmRestore(true)}><RotateCcw size={14}/>Restore this checkpoint</button>}
        </>}
      </div>}
    </dialog>
  </>;
}
