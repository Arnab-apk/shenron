/**
 * Tooltip — Accessible tooltip component with smart positioning.
 * Provides contextual help without cluttering the UI.
 */

import React, { useState, useRef, useEffect, useId } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

const OFFSET = 6;

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 500,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const showTooltip = () => {
    if (disabled) return;

    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();

        let x = 0;
        let y = 0;

        switch (position) {
          case 'top':
            x = rect.left + rect.width / 2;
            y = rect.top - OFFSET;
            break;
          case 'bottom':
            x = rect.left + rect.width / 2;
            y = rect.bottom + OFFSET;
            break;
          case 'left':
            x = rect.left - OFFSET;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right + OFFSET;
            y = rect.top + rect.height / 2;
            break;
        }

        setCoords({ x, y });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? tooltipId : undefined}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`fixed z-[300] px-2 py-1 rounded-ctl border border-line bg-bg-elevated text-fg font-sans text-[11px] font-medium leading-4 whitespace-nowrap pointer-events-none shadow-subtle animate-fade-in ${positionClasses[position]}`}
          style={{
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            animationDuration: '120ms',
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};
