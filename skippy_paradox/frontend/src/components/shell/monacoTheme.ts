/**
 * Shenron Monaco theme — shared by ModernMonacoEditor and CollabMonacoEditor.
 * Dark only; colours mirror the design tokens in src/index.css.
 */
export const SHENRON_MONACO_THEME = 'shenron-dark';

export const SHENRON_MONACO_THEME_DATA = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'E6E6EB' },
    { token: 'comment', foreground: '5C5C6B', fontStyle: 'italic' },
    { token: 'keyword', foreground: '56C0F2' },
    { token: 'string', foreground: '9DD3A8' },
    { token: 'number', foreground: 'F2B66B' },
    { token: 'regexp', foreground: 'F2B66B' },
    { token: 'type', foreground: '6FD6C6' },
    { token: 'function', foreground: 'E8D9A0' },
    { token: 'variable', foreground: 'E6E6EB' },
    { token: 'operator', foreground: '8B8B99' },
    { token: 'delimiter', foreground: '8B8B99' },
    { token: 'tag', foreground: '56C0F2' },
    { token: 'attribute.name', foreground: '6FD6C6' },
  ],
  colors: {
    'editor.background': '#0A0A0F',
    'editor.foreground': '#E6E6EB',
    'editor.lineHighlightBackground': '#111118',
    'editor.lineHighlightBorder': '#00000000',
    'editorGutter.background': '#0A0A0F',
    'editorLineNumber.foreground': '#5C5C6B',
    'editorLineNumber.activeForeground': '#8B8B99',
    'editor.selectionBackground': '#56C0F240',
    'editor.inactiveSelectionBackground': '#56C0F21F',
    'editor.selectionHighlightBackground': '#56C0F21A',
    'editor.wordHighlightBackground': '#56C0F21A',
    'editor.findMatchBackground': '#56C0F24D',
    'editor.findMatchHighlightBackground': '#56C0F226',
    'editorCursor.foreground': '#56C0F2',
    'editorWhitespace.foreground': '#23232E',
    'editorIndentGuide.background1': '#1A1A23',
    'editorIndentGuide.activeBackground1': '#2E2E3A',
    'editorIndentGuide.background': '#1A1A23',
    'editorIndentGuide.activeBackground': '#2E2E3A',
    'editorBracketMatch.background': '#56C0F21A',
    'editorBracketMatch.border': '#56C0F266',
    'editorWidget.background': '#16161F',
    'editorWidget.border': '#23232E',
    'editorSuggestWidget.background': '#16161F',
    'editorSuggestWidget.border': '#23232E',
    'editorSuggestWidget.selectedBackground': '#56C0F226',
    'editorHoverWidget.background': '#16161F',
    'editorHoverWidget.border': '#23232E',
    'input.background': '#0A0A0F',
    'input.border': '#23232E',
    'focusBorder': '#56C0F2',
    'minimap.background': '#0A0A0F',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#2E2E3A80',
    'scrollbarSlider.hoverBackground': '#2E2E3AB3',
    'scrollbarSlider.activeBackground': '#5C5C6BB3',
    'editorOverviewRuler.border': '#00000000',
  },
};

/** Background shown while Monaco loads. */
export const SHENRON_EDITOR_BG = '#0A0A0F';
