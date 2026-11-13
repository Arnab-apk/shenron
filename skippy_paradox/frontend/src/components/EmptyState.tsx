/**
 * EmptyState — Quiet empty state with clear guidance and calls-to-action.
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}) => {
  return (
    <div className="flex items-center justify-center h-full min-h-[240px] p-6 font-sans">
      <div className="text-center max-w-[320px]">
        <div className="w-10 h-10 mx-auto mb-4 rounded-ctl border border-line bg-bg-elevated flex items-center justify-center">
          <Icon size={18} className="text-fg-secondary" />
        </div>

        <h3 className="text-[14px] font-medium text-fg mb-1">
          {title}
        </h3>

        <p className="text-[12px] leading-[18px] text-fg-secondary">
          {description}
        </p>

        {(action || secondaryAction) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {action && (
              <button
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl bg-accent hover:bg-accent-hover text-[#0A0A0F] text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                {action.icon && <action.icon size={14} />}
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-ctl border border-line bg-bg-elevated hover:border-line-hover text-fg text-[12px] font-medium transition-colors outline-none focus-visible:border-accent"
              >
                {secondaryAction.icon && <secondaryAction.icon size={14} className="text-fg-secondary" />}
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
