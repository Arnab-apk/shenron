/**
 * CodeRunner — Authentic, sleek terminal UI for running code via OnlineCompiler / Backend API.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Loader2,
  Terminal as TerminalIcon,
  Check,
  Copy,
  Trash2,
  CornerDownLeft,
  X,
  Clock,
  Cpu,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { executeCode, mapMonacoLanguageToJudge0, ExecutionResult } from '../services/judge0Service';
import { inferLanguageFromSnippet } from '../utils/detectLanguage';

export const SUPPORTED_RUNNER_LANGS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'C++',
  'C',
  'Java',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'C#',
  'Bash',
  'SQL',
];

interface CodeRunnerProps {
  code: string;
  language: string;
  fileName: string;
  onClose?: () => void;
  onLanguageChange?: (language: string) => void;
}

interface TerminalSession {
  id: string;
  timestamp: string;
  command: string;
  result?: ExecutionResult;
  error?: string;
}

const getCommandForLanguage = (language: string, fileName: string): string => {
  const lang = (language || '').toLowerCase();
  const name = fileName || 'script';
  if (lang.includes('python')) return `python3 ${name}`;
  if (lang.includes('javascript') || lang === 'js' || lang === 'node') return `node ${name}`;
  if (lang.includes('typescript') || lang === 'ts') return `deno run ${name}`;
  if (lang.includes('cpp') || lang.includes('c++')) return `g++ -O2 ${name} && ./a.out`;
  if (lang === 'c') return `gcc -O2 ${name} && ./a.out`;
  if (lang.includes('java')) return `javac ${name} && java Main`;
  if (lang.includes('go')) return `go run ${name}`;
  if (lang.includes('rust')) return `rustc ${name} && ./main`;
  if (lang.includes('ruby')) return `ruby ${name}`;
  if (lang.includes('php')) return `php ${name}`;
  if (lang.includes('csharp') || lang.includes('c#')) return `dotnet run ${name}`;
  return `run ${name}`;
};

export const CodeRunner: React.FC<CodeRunnerProps> = ({
  code,
  language,
  fileName,
  onClose,
  onLanguageChange,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<TerminalSession[]>([]);
  const [currentRunningCmd, setCurrentRunningCmd] = useState<string | null>(null);
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const detected = inferLanguageFromSnippet(code);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    language || detected || 'Python'
  );

  useEffect(() => {
    if (language) {
      setSelectedLanguage(language);
    } else if (detected) {
      setSelectedLanguage(detected);
    }
  }, [language, detected]);

  // Auto-scroll to bottom when new terminal output arrives
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isRunning]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;

    const activeLang = selectedLanguage || language || detected || 'Python';
    const trimmedCode = code.trim();
    const command = getCommandForLanguage(activeLang, fileName);
    const timeStr = new Date().toLocaleTimeString([], { hour12: false });
    const sessionId = Date.now().toString();

    if (!trimmedCode) {
      setHistory((prev) => [
        ...prev,
        {
          id: sessionId,
          timestamp: timeStr,
          command,
          error: 'Error: Cannot execute empty source file. Write some code first.',
        },
      ]);
      return;
    }

    setIsRunning(true);
    setCurrentRunningCmd(command);

    try {
      let effectiveLang = activeLang;
      if (/^\s*(def |import |from |print\(|class .*?:|if __name__)/m.test(code) && !/console\.log|const |let |var |function /m.test(code)) {
        effectiveLang = 'Python';
      }
      const judge0Lang = mapMonacoLanguageToJudge0(effectiveLang);
      const executionResult = await executeCode({
        source_code: code,
        language: judge0Lang,
        stdin: stdin || undefined,
      });

      setHistory((prev) => [
        ...prev,
        {
          id: sessionId,
          timestamp: timeStr,
          command,
          result: executionResult,
        },
      ]);
    } catch (e: any) {
      const msg = e?.message || 'Execution failed';
      let friendlyError = msg;
      if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        friendlyError =
          'Network Error: Could not connect to API server. Ensure the backend server is running and accessible.';
      }

      setHistory((prev) => [
        ...prev,
        {
          id: sessionId,
          timestamp: timeStr,
          command,
          error: friendlyError,
        },
      ]);
    } finally {
      setIsRunning(false);
      setCurrentRunningCmd(null);
    }
  }, [code, language, fileName, stdin, isRunning, selectedLanguage, detected]);

  // Global shortcut: Ctrl+Enter or Cmd+Enter to run code
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  const handleClear = () => {
    setHistory([]);
  };

  const handleCopy = async () => {
    if (history.length === 0) return;
    const textToCopy = history
      .map((item) => {
        let text = `$ ${item.command}\n`;
        if (item.error) text += `[ERROR] ${item.error}\n`;
        if (item.result?.compile_output) text += `[COMPILATION ERROR]\n${item.result.compile_output}\n`;
        if (item.result?.stdout) text += item.result.stdout;
        if (item.result?.stderr) text += `[STDERR]\n${item.result.stderr}\n`;
        if (item.result?.status) text += `[Status: ${item.result.status.description}]\n`;
        return text;
      })
      .join('\n───────────────────────\n\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy terminal output:', err);
    }
  };

  const lastSession = history.length > 0 ? history[history.length - 1] : null;
  const lastResult = lastSession?.result;
  const isAccepted = lastResult?.status?.id === 3;

  return (
    <div className="flex flex-col h-full bg-bg text-fg border-t border-line select-text overflow-hidden font-sans">
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between h-9 px-2 bg-bg-panel border-b border-line shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-fg-secondary">
            <TerminalIcon size={14} className="text-fg-secondary" /> Output
          </span>
          <span className="text-[11px] font-mono text-fg-muted hidden sm:inline-block truncate max-w-[160px]">
            {fileName || 'script'}
          </span>
          {/* Language Selector Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedLanguage}
              onChange={(e) => {
                const nextLang = e.target.value;
                setSelectedLanguage(nextLang);
                onLanguageChange?.(nextLang);
              }}
              aria-label="Execution Language"
              className="h-6 bg-bg border border-line hover:border-line-hover text-fg-secondary text-[11px] pl-2 pr-5 rounded-ctl focus:outline-none focus:border-accent cursor-pointer appearance-none transition-colors"
              title="Execution language"
            >
              {SUPPORTED_RUNNER_LANGS.map((lang) => (
                <option key={lang} value={lang} className="bg-bg-elevated text-fg">
                  {lang}
                </option>
              ))}
            </select>
            <span className="absolute right-1.5 pointer-events-none text-fg-muted text-[8px]">▾</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowStdin(!showStdin)}
            aria-label="Toggle STDIN input"
            aria-pressed={showStdin}
            className={`relative inline-flex items-center gap-1 h-7 px-2 rounded-ctl text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              showStdin ? 'bg-white/5 text-fg' : 'text-fg-secondary hover:text-fg hover:bg-white/5'
            }`}
            title="Toggle program standard input (stdin)"
          >
            <CornerDownLeft size={14} />
            <span className="hidden sm:inline">stdin</span>
            {stdin.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>

          <button
            onClick={handleCopy}
            disabled={history.length === 0}
            aria-label="Copy terminal output"
            className="inline-flex items-center justify-center w-7 h-7 rounded-ctl text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            title="Copy terminal output"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>

          <button
            onClick={handleClear}
            disabled={history.length === 0 && !isRunning}
            aria-label="Clear terminal"
            className="inline-flex items-center justify-center w-7 h-7 rounded-ctl text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-accent hover:!text-danger"
            title="Clear terminal (clear)"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning || !code.trim()}
            aria-label="Run Code"
            className="ml-1 inline-flex items-center gap-1.5 h-7 px-3 bg-accent hover:bg-accent-hover text-[#0A0A0F] rounded-ctl text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            title="Execute Code (Ctrl + Enter)"
          >
            {isRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Run</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close or clear terminal"
              className="inline-flex items-center justify-center w-7 h-7 rounded-ctl text-fg-secondary hover:text-fg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ml-0.5"
              title="Close Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── STDIN Input Drawer ── */}
      {showStdin && (
        <div className="px-3 py-2 bg-bg-panel border-b border-line shrink-0 animate-fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted flex items-center gap-1">
              <CornerDownLeft size={12} /> Program input
            </span>
            {stdin && (
              <button
                onClick={() => setStdin('')}
                className="text-[11px] text-fg-secondary hover:text-fg transition-colors"
              >
                Clear input
              </button>
            )}
          </div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Type standard input here (e.g. for input(), scanf(), cin, readline)..."
            rows={3}
            className="w-full px-2.5 py-1.5 rounded-ctl bg-bg border border-line text-[12px] font-mono text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent resize-none custom-scrollbar leading-relaxed"
          />
        </div>
      )}

      {/* ── Output canvas ── */}
      <div
        ref={terminalContainerRef}
        className="flex-1 p-3 overflow-y-auto custom-scrollbar font-mono text-[12px] leading-relaxed space-y-3 bg-bg"
      >
        <div className="text-fg-muted text-[11px] leading-relaxed font-mono select-none">
          <div className="text-fg-secondary">Shenron Cloud Terminal · OnlineCompiler</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Target: <span className="text-fg-secondary">{fileName || 'main'}</span></span>
            <span>Language: <span className="text-fg-secondary">{language || 'Plain Text'}</span></span>
            <span>Run: <span className="text-fg-secondary">Ctrl + Enter</span></span>
          </div>
        </div>

        {/* History of executed runs */}
        {history.map((session, idx) => {
          const res = session.result;

          return (
            <div key={session.id} className="space-y-1.5 pt-1">
              {/* Command Prompt Line */}
              <div className="flex items-center gap-1.5 text-fg-secondary">
                <span className="text-success font-semibold select-none">guest@shenron</span>
                <span className="text-fg-muted select-none">:</span>
                <span className="text-accent font-semibold select-none">~</span>
                <span className="text-fg-muted select-none">$</span>
                <span className="text-fg font-bold">{session.command}</span>
                <span className="text-[9px] text-fg-muted ml-auto select-none">{session.timestamp}</span>
              </div>

              {/* Network / Client error */}
              {session.error && (
                <div className="pl-3 border-l-2 border-[#F26B6B]/60 text-danger text-[11px] bg-[#F26B6B]/10 py-1.5 px-2 rounded-r">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <AlertCircle size={13} />
                    <span>Execution Error</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono">{session.error}</pre>
                </div>
              )}

              {/* Compilation Error Output */}
              {res?.compile_output && (
                <div className="pl-3 border-l-2 border-amber-500 text-danger text-[11px] bg-[#F26B6B]/10 py-1.5 px-2 rounded-r">
                  <div className="text-amber-400 font-bold text-[10px] mb-1 tracking-wider uppercase flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>Compilation Error</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-danger font-mono">{res.compile_output}</pre>
                </div>
              )}

              {/* Standard Output (stdout) */}
              {res?.stdout && (
                <div className="pl-3 border-l-2 border-[#4ADE80]/60 text-success py-1 px-1">
                  <pre className="whitespace-pre-wrap font-mono text-fg select-text leading-relaxed">
                    {res.stdout}
                  </pre>
                </div>
              )}

              {/* Standard Error (stderr) */}
              {res?.stderr && (
                <div className="pl-3 border-l-2 border-[#F26B6B]/60 text-danger py-1 px-1 bg-[#F26B6B]/5 rounded-r">
                  <div className="text-danger font-semibold text-[10px] mb-0.5 uppercase tracking-wide">
                    STDERR
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-danger select-text leading-relaxed">
                    {res.stderr}
                  </pre>
                </div>
              )}

              {/* Special message from compiler */}
              {res?.message && (
                <div className="pl-3 border-l-2 border-yellow-500/80 text-yellow-300 text-[11px] py-1 px-1">
                  <pre className="whitespace-pre-wrap font-mono">{res.message}</pre>
                </div>
              )}

              {/* Empty Output Note */}
              {res && !res.stdout && !res.stderr && !res.compile_output && !res.message && (
                <div className="text-fg-muted italic text-[11px] pl-3">
                  (Program finished with no console output)
                </div>
              )}

              {/* Process summary footer */}
              {res && (
                <div className="flex items-center gap-3 text-[10px] text-fg-muted pt-0.5 pl-3 select-none">
                  <div className="flex items-center gap-1">
                    {res.status.id === 3 ? (
                      <span className="text-success flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={11} /> {res.status.description}
                      </span>
                    ) : (
                      <span className="text-danger flex items-center gap-1 font-semibold">
                        <AlertCircle size={11} /> {res.status.description}
                      </span>
                    )}
                  </div>
                  {res.time && (
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>{res.time}s</span>
                    </div>
                  )}
                  {res.memory && (
                    <div className="flex items-center gap-1">
                      <Cpu size={10} />
                      <span>{(res.memory / 1024).toFixed(1)} MB</span>
                    </div>
                  )}
                </div>
              )}

              {/* Divider between sessions */}
              {idx < history.length - 1 && (
                <div className="border-b border-line my-2" />
              )}
            </div>
          );
        })}

        {/* Active Running State */}
        {isRunning && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-fg-secondary">
              <span className="text-success font-semibold">guest@shenron</span>
              <span className="text-fg-muted">:</span>
              <span className="text-accent font-semibold">~</span>
              <span className="text-fg-muted">$</span>
              <span className="text-fg font-bold">{currentRunningCmd}</span>
            </div>
            <div className="flex items-center gap-2 pl-3 text-success text-xs py-1">
              <Loader2 size={13} className="animate-spin" />
              <span className="animate-pulse">Compiling & executing in cloud sandbox...</span>
            </div>
          </div>
        )}

        {/* Interactive Prompt & Blinking Cursor when idle */}
        {!isRunning && (
          <div className="flex items-center gap-1.5 text-fg-secondary pt-1 select-none">
            <span className="text-success font-semibold">guest@shenron</span>
            <span className="text-fg-muted">:</span>
            <span className="text-accent font-semibold">~</span>
            <span className="text-fg-muted">$</span>
            <span className="inline-block w-2 h-4 bg-accent animate-pulse align-middle" />
          </div>
        )}

        <div ref={terminalBottomRef} />
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between h-6 px-3 bg-bg-panel border-t border-line text-[11px] text-fg-secondary select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning
                  ? 'bg-accent animate-pulse'
                  : isAccepted
                  ? 'bg-success'
                  : 'bg-fg-muted'
              }`}
            />
            <span>
              {isRunning
                ? 'Running'
                : lastResult
                ? lastResult.status.description
                : 'Ready'}
            </span>
          </span>
          {lastResult?.time && (
            <span className="text-fg-muted">· {lastResult.time}s</span>
          )}
        </div>
        <span className="text-fg-muted">Ctrl + Enter to run</span>
      </div>
    </div>
  );
};
