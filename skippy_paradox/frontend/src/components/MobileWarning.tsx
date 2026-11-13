import React from 'react';
import { VERSION } from '../constants';
import { Monitor } from 'lucide-react';

export const MobileWarning: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg font-sans">
      <div className="max-w-sm w-full">
        <div className="flex items-baseline justify-center gap-2 mb-4">
          <h1 className="text-[18px] font-semibold tracking-tight text-fg select-none">Shenron</h1>
          <span className="text-[11px] font-mono text-fg-muted">v{VERSION}</span>
        </div>

        <div className="rounded-panel border border-line bg-bg-panel p-3 shadow-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Monitor size={16} className="text-fg-secondary shrink-0" />
            <h2 className="text-[13px] font-semibold text-fg">Desktop experience required</h2>
          </div>

          <p className="text-[12px] leading-relaxed text-fg-secondary">
            Shenron's editor needs a larger screen. Open this page on a desktop or laptop with a
            screen width of at least <span className="text-fg font-medium">1024px</span>.
          </p>

          <div className="mt-3 pt-3 border-t border-line">
            <p className="text-[11px] text-fg-muted">
              Mobile layout is under development and will be available soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
