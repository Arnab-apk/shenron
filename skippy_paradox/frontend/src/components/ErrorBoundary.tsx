/**
 * ErrorBoundary — Graceful error handling for React components.
 * Prevents entire app crashes and provides user-friendly error UI.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div role="alert" className="flex items-center justify-center h-full min-h-[320px] p-6 bg-bg font-sans">
          <div className="w-full max-w-[400px] rounded-panel border border-line bg-bg-panel p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="shrink-0 text-danger" />
              <h2 className="text-[14px] font-medium text-fg">
                Something went wrong
              </h2>
            </div>
            <p className="text-[12px] leading-[18px] text-fg-secondary mb-3">
              Shenron hit an unexpected error while rendering this view.
            </p>
            <pre className="mb-4 max-h-32 overflow-auto rounded-ctl border border-line bg-bg px-2.5 py-2 font-mono text-[11px] leading-4 text-fg-secondary whitespace-pre-wrap break-words">
              {this.state.error?.message || 'An unexpected error occurred'}
            </pre>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl bg-accent hover:bg-accent-hover text-[#0A0A0F] text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              <RotateCw size={14} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
