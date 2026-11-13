import React from 'react';
import { Settings, Trash2 } from 'lucide-react';
import { StoredFile } from '../services/storageService';
import { geminiKeyRotation } from '../services/geminiKeyRotation';
import { AgentHeader, iconBtn } from './agent/ui';
import { ProviderPicker } from './agent/ProviderPicker';
import { AgentChat } from './agent/AgentChat';
import { AgentSettings, ConversationMenu, KeyStats } from './agent/AgentSettings';
import { useGeminiAgent } from './agent/useGeminiAgent';
import { GEMINI_API_KEY_STORAGE, GEMINI_MODELS, OPENROUTER_MODELS } from './agent/geminiStore';

interface GeminiPanelProps {
  activeFile: StoredFile | null;
  allFiles?: StoredFile[];
  onCodeChange?: (fileId: string, content: string) => void;
  onFileCreate?: () => void;
  onAgentFileCreate?: (name: string, content: string, language?: string) => void;
}

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'gemini', label: 'Gemini' },
];

export const GeminiPanel: React.FC<GeminiPanelProps> = (props) => {
  const agent = useGeminiAgent(props);
  const { provider, model } = agent;

  const baseModels = provider === 'openrouter' ? OPENROUTER_MODELS : GEMINI_MODELS;
  // Keep a custom/preset model visible in the compact select.
  const models = baseModels.some((m) => m.value === model) || !model
    ? baseModels
    : [{ value: model, label: model }, ...baseModels];

  const showKeyStats = !localStorage.getItem(GEMINI_API_KEY_STORAGE) && provider === 'gemini' && geminiKeyRotation.hasKeys();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg-panel font-sans text-fg">
      <AgentHeader>
        <ConversationMenu
          conversations={agent.conversations}
          activeId={agent.activeConvId || ''}
          onSelect={agent.switchConversation}
          onNew={agent.startNewConversation}
          onDelete={agent.deleteConversation}
        />
        <button
          type="button"
          onClick={() => agent.setShowConfigModal(!agent.showConfigModal)}
          className={`${iconBtn} ${agent.showConfigModal ? 'bg-white/5 text-fg' : ''}`}
          title="Agent & Model Settings"
          aria-label="Agent & Model Settings"
        >
          <Settings size={14} />
        </button>
        {agent.messages.length > 0 && (
          <button
            type="button"
            onClick={agent.clearMessages}
            className={`${iconBtn} hover:text-danger`}
            title="Clear chat"
            aria-label="Clear chat"
          >
            <Trash2 size={14} />
          </button>
        )}
      </AgentHeader>

      <div className="shrink-0 space-y-2 border-b border-line p-3">
        <ProviderPicker
          provider={provider}
          providers={PROVIDERS}
          onProviderChange={(value) => {
            if (value === 'gemini') { agent.setProvider('gemini'); agent.setModel('gemini-2.0-flash'); }
            else { agent.setProvider('openrouter'); agent.setModel('nvidia/nemotron-3.5-lightning:free'); }
          }}
          model={model}
          models={models}
          onModelChange={agent.setModel}
          modelTitle={provider === 'openrouter' ? 'Select OpenRouter Model' : 'Select Gemini Model'}
          trailing={showKeyStats ? <KeyStats stats={agent.keyStats} onReset={agent.resetKeyUsage} /> : undefined}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={agent.isAgentHarness}
            onClick={() => agent.setIsAgentHarness(!agent.isAgentHarness)}
            className="inline-flex items-center gap-2 text-[12px] text-fg-secondary hover:text-fg"
            title="Toggle Autonomous Tool Calling Loop"
          >
            <span
              className={`relative inline-block h-4 w-7 rounded-full border transition-colors ${
                agent.isAgentHarness ? 'border-accent bg-accent' : 'border-line bg-bg'
              }`}
            >
              <span
                className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all ${
                  agent.isAgentHarness ? 'left-[13px] bg-[#0A0A0F]' : 'left-0.5 bg-fg-muted'
                }`}
              />
            </span>
            {agent.isAgentHarness ? 'Autonomous' : 'Chat only'}
          </button>
        </div>

        {agent.showConfigModal && (
          <AgentSettings
            provider={provider}
            model={model}
            onModelChange={agent.setModel}
            openRouterKey={agent.openRouterKey}
            onOpenRouterKeyChange={agent.setOpenRouterKey}
            geminiCustomKey={agent.geminiCustomKey}
            onGeminiCustomKeyChange={agent.setGeminiCustomKey}
            onClose={() => agent.setShowConfigModal(false)}
          />
        )}
      </div>

      <AgentChat
        activeFile={props.activeFile}
        messages={agent.messages}
        streamingMsgId={agent.streamingMsgId.current}
        isLoading={agent.isLoading}
        input={agent.input}
        onInputChange={agent.setInput}
        onSubmit={agent.handleSubmit}
        onKeyDown={agent.handleKeyDown}
        onSend={agent.sendMessage}
        onStop={agent.stopStreaming}
        scrollContainerRef={agent.scrollContainerRef}
        messagesEndRef={agent.messagesEndRef}
      />
    </div>
  );
};
