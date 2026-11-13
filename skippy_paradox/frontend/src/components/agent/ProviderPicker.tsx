import React from 'react';
import { RefreshCw } from 'lucide-react';
import { iconBtn, selectCls } from './ui';

export interface PickerOption {
  value: string;
  label: string;
}

interface ProviderPickerProps {
  provider: string;
  providers: PickerOption[];
  onProviderChange: (value: string) => void;
  model: string;
  models: PickerOption[];
  onModelChange: (value: string) => void;
  /** Optional leading empty option for the model select (e.g. "Select a model"). */
  modelPlaceholder?: string;
  providerDisabled?: boolean;
  modelDisabled?: boolean;
  providerAriaLabel?: string;
  modelAriaLabel?: string;
  providerTitle?: string;
  modelTitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshDisabled?: boolean;
  /** Extra content rendered at the end of the row (e.g. key usage stats). */
  trailing?: React.ReactNode;
}

/** Compact provider + model selector row used by the Shenron Agent panels. */
export function ProviderPicker({
  provider,
  providers,
  onProviderChange,
  model,
  models,
  onModelChange,
  modelPlaceholder,
  providerDisabled,
  modelDisabled,
  providerAriaLabel = 'AI provider',
  modelAriaLabel = 'AI model',
  providerTitle,
  modelTitle,
  onRefresh,
  refreshing,
  refreshDisabled,
  trailing,
}: ProviderPickerProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <select
        aria-label={providerAriaLabel}
        title={providerTitle}
        disabled={providerDisabled}
        className={`${selectCls} w-[118px] shrink-0`}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value)}
      >
        {providers.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <select
        aria-label={modelAriaLabel}
        title={modelTitle}
        disabled={modelDisabled}
        className={`${selectCls} flex-1 font-mono text-[11px]`}
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
      >
        {modelPlaceholder !== undefined && <option value="">{modelPlaceholder}</option>}
        {models.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      {onRefresh && (
        <button
          type="button"
          aria-label="Refresh models"
          title="Refresh models"
          disabled={refreshDisabled}
          onClick={onRefresh}
          className={iconBtn}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      )}
      {trailing}
    </div>
  );
}
