import { useMemo } from 'react';
import { createTwoFilesPatch } from 'diff';
import { Download } from 'lucide-react';
import { FileDiff } from '../services/workspaceService';

// `isDark` is kept in the props for API compatibility; the diff always renders the dark token look.
export function CheckpointDiff({diff}:{diff:FileDiff;isDark:boolean}) {
  const patch=useMemo(()=>createTwoFilesPatch('checkpoint/'+diff.path,'current/'+diff.path,diff.before||'',diff.after||'','','',{context:3,timeout:200,maxEditLength:10000}),[diff.path,diff.before,diff.after]);
  const lines=(patch||'').split('\n');
  const download=()=>{
    const url=URL.createObjectURL(new Blob([patch||''],{type:'text/plain'}));
    const link=document.createElement('a');link.href=url;link.download=diff.path.split('/').join('_')+'.patch';link.click();URL.revokeObjectURL(url);
  };
  if(!patch)return <div className="grid grid-cols-2 gap-2 text-fg">
    <div className="min-w-0 overflow-hidden rounded-ctl border border-line">
      <p className="border-b border-line px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted">Checkpoint</p>
      <pre className="max-h-80 overflow-auto whitespace-pre bg-bg p-2 font-mono text-[12px] text-fg">{diff.before}</pre>
    </div>
    <div className="min-w-0 overflow-hidden rounded-ctl border border-line">
      <p className="border-b border-line px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted">Current</p>
      <pre className="max-h-80 overflow-auto whitespace-pre bg-bg p-2 font-mono text-[12px] text-fg">{diff.after}</pre>
    </div>
    <p className="col-span-2 text-[12px] text-fg-secondary">The change is too large for a line diff. Both versions are shown for comparison.</p>
  </div>;
  return <div aria-label={'Checkpoint diff for '+diff.path} className="overflow-hidden rounded-ctl border border-line bg-bg text-fg">
    <div className="flex items-center justify-between gap-2 border-b border-line bg-bg-elevated px-3 py-1.5 text-[12px] text-fg-secondary">
      <span><span className="text-danger">−</span> Removed from checkpoint · <span className="text-success">+</span> Added in current files</span>
      <button className="inline-flex h-7 items-center gap-1.5 rounded-ctl px-2 text-[12px] font-medium text-fg-secondary hover:bg-white/5 hover:text-fg focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent" onClick={download}><Download size={14} />Download diff</button>
    </div>
    <pre className="max-h-[45dvh] overflow-auto font-mono text-[12px] leading-5" tabIndex={0}>{lines.slice(0,1500).map((line,index)=><span key={index} className={`block min-h-5 px-3 ${line.startsWith('+')&&!line.startsWith('+++')?'bg-[rgba(74,222,128,0.08)] text-success':line.startsWith('-')&&!line.startsWith('---')?'bg-[rgba(242,107,107,0.08)] text-danger':line.startsWith('@@')?'bg-white/[0.03] text-accent':'text-fg-secondary'}`}>{line||' '}</span>)}</pre>
    {lines.length>1500&&<p className="border-t border-line p-2 text-[12px] text-fg-secondary">Showing the first 1,500 lines. Download the diff to review the entire change.</p>}
  </div>;
}
