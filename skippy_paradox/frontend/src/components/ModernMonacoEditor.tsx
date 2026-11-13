import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { StoredFile } from '../services/storageService';
import { Loader2 } from 'lucide-react';
import { SHENRON_MONACO_THEME, SHENRON_MONACO_THEME_DATA, SHENRON_EDITOR_BG } from './shell/monacoTheme';

interface ModernMonacoEditorProps {
    file: StoredFile;
    theme: 'dark' | 'light';
    fontSize: number;
    onChange: (value: string) => void;
    onCursorChange: (ln: number, col: number) => void;
    onSelectionChange: (count: number) => void;
}

// Map common language names to Monaco language IDs
const LANGUAGE_MAP: Record<string, string> = {
    'JavaScript': 'javascript',
    'TypeScript': 'typescript',
    'Python': 'python',
    'Java': 'java',
    'C++': 'cpp',
    'C': 'c',
    'Go': 'go',
    'Rust': 'rust',
    'Ruby': 'ruby',
    'PHP': 'php',
    'HTML': 'html',
    'CSS': 'css',
    'JSON': 'json',
    'JSX': 'javascript',
    'TSX': 'typescript'
};

// Theme: see ./shell/monacoTheme (Shenron dark, used for both theme values)

export const ModernMonacoEditor: React.FC<ModernMonacoEditorProps> = ({
    file,
    theme,
    fontSize,
    onChange,
    onCursorChange,
    onSelectionChange,
}) => {
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof Monaco | null>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Define custom themes
        monaco.editor.defineTheme(SHENRON_MONACO_THEME, SHENRON_MONACO_THEME_DATA as any);

        // Set the theme
        monaco.editor.setTheme(SHENRON_MONACO_THEME);

        // Disable TypeScript/JavaScript diagnostics to prevent errors
        try {
            const tsDefaults = monaco.languages.typescript?.typescriptDefaults;
            const jsDefaults = monaco.languages.typescript?.javascriptDefaults;
            const diagOff = {
                noSemanticValidation: true,
                noSyntaxValidation: true,
                noSuggestionDiagnostics: true,
            };
            tsDefaults?.setDiagnosticsOptions(diagOff);
            jsDefaults?.setDiagnosticsOptions(diagOff);
        } catch {
            // Silently ignore
        }

        // Cursor position tracking
        editor.onDidChangeCursorPosition((e) => {
            onCursorChange(e.position.lineNumber, e.position.column);
        });

        // Selection tracking
        editor.onDidChangeCursorSelection(() => {
            const selection = editor.getSelection();
            if (selection) {
                const model = editor.getModel();
                if (model) {
                    const selectedText = model.getValueInRange(selection);
                    onSelectionChange(selectedText.length);
                }
            }
        });
        // Fix minimap lag during CSS transitions
        const container = editor.getContainerDomNode().parentElement;
        if (container) {
            const ro = new ResizeObserver(() => {
                editor.layout();
            });
            ro.observe(container);
            
            // Clean up the observer when editor is disposed
            editor.onDidDispose(() => {
                ro.disconnect();
            });
        }
    };

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            onChange(value);
        }
    };

    // Update theme when it changes
    React.useEffect(() => {
        if (monacoRef.current) {
            monacoRef.current.editor.setTheme(SHENRON_MONACO_THEME);
        }
    }, [theme]);

    const languageId = LANGUAGE_MAP[file.language] || file.language.toLowerCase() || 'javascript';

    return (
        <div className="relative w-full h-full">
            <Editor
                height="100%"
                language={languageId}
                value={file.content}
                theme={SHENRON_MONACO_THEME}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                loading={
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: SHENRON_EDITOR_BG }}>
                        <Loader2 className="animate-spin text-fg-muted" size={24} />
                    </div>
                }
                options={{
                    automaticLayout: true,
                    fontSize,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    minimap: {
                        enabled: true,
                        showSlider: 'mouseover',
                        renderCharacters: true,
                    },
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    padding: { top: 16, bottom: 16 },
                    bracketPairColorization: { enabled: true },
                    renderLineHighlight: 'line',
                    contextmenu: true,
                    scrollbar: {
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                    },
                    stickyScroll: {
                        enabled: false,
                    },
                }}
            />
        </div>
    );
};
