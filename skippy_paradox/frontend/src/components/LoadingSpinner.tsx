/**
 * LoadingSpinner — Loading states with multiple variants.
 * Provides visual feedback during async operations.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'spinner',
  text,
  fullScreen = false,
}) => {
  const sizeMap = {
    sm: 14,
    md: 16,
    lg: 24,
    xl: 32,
  };

  const iconSize = sizeMap[size];

  const renderSpinner = () => {
    switch (variant) {
      case 'spinner':
        return (
          <Loader2
            size={iconSize}
            strokeWidth={1.75}
            className="animate-spin text-fg-secondary"
            aria-hidden
          />
        );

      case 'dots':
        return (
          <div className="flex items-center gap-1" aria-hidden>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-fg-secondary"
                style={{
                  animation: 'pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className="relative w-3 h-3" aria-hidden>
            <div className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
            <div className="relative w-3 h-3 rounded-full bg-accent" />
          </div>
        );

      case 'skeleton':
        return (
          <div className="space-y-2 w-full max-w-sm" aria-hidden>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-3 rounded-[4px] bg-white/[0.06] animate-pulse"
                style={{ width: `${100 - i * 15}%` }}
              />
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const content = (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-2.5 font-sans">
      {renderSpinner()}
      {text ? (
        <p className="text-[12px] text-fg-secondary">
          {text}
        </p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
        {content}
      </div>
    );
  }

  return content;
};
