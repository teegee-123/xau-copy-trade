import React, { useState, useCallback } from 'react';
import { useConfig } from '../hooks/useConfig';
import { TemplateTester } from './TemplateTester';
import type { SignalTemplate, MatchType } from '../types';

interface ConfigPanelProps {
  onClose: () => void;
}

type TabType = 'channel' | 'entry' | 'sltp' | 'price' | 'trading' | 'tester';

export function ConfigPanel({ onClose }: ConfigPanelProps) {
  const { config, loading, error, updateConfig } = useConfig();
  const [activeTab, setActiveTab] = useState<TabType>('channel');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Advanced mode toggle for template editing
  const [advancedMode, setAdvancedMode] = useState<{ entry: boolean; sltp: boolean }>({
    entry: false,
    sltp: false,
  });

  // Local state for form inputs
  const [channelConfig, setChannelConfig] = useState({ channelId: '', channelName: '' });
  const [entryTemplate, setEntryTemplate] = useState<SignalTemplate>({
    description: '',
    matchType: 'regex',
    pattern: '',
    flags: 'i',
    matchValue: '',
    caseSensitive: false,
    extractionRules: {},
    examples: [],
  });
  const [sltpTemplate, setSltpTemplate] = useState<SignalTemplate>({
    description: '',
    matchType: 'regex',
    pattern: '',
    flags: 'i',
    matchValue: '',
    caseSensitive: false,
    extractionRules: {},
    examples: [],
  });
  const [tradingConfig, setTradingConfig] = useState({ defaultLotSize: 0.1, slTpTimeoutMinutes: 3, entryPriceTolerance: 2 });
  const [priceFeedConfig, setPriceFeedConfig] = useState({ pollingIntervalMs: 1000 });

  // Sync local state with config
  React.useEffect(() => {
    if (config) {
      setChannelConfig(config.channel);
      setEntryTemplate(config.entrySignalTemplate);
      setSltpTemplate(config.sltpSignalTemplate);
      setTradingConfig({
        defaultLotSize: config.trading.defaultLotSize,
        slTpTimeoutMinutes: config.trading.slTpTimeoutMinutes,
        entryPriceTolerance: config.trading.entryPriceTolerance ?? 2,
      });
      setPriceFeedConfig(config.priceFeed);
    }
  }, [config]);

  const showSaveMessage = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  }, []);

  const handleChannelSave = async () => {
    setSaving(true);
    const success = await updateConfig('channel', channelConfig);
    setSaving(false);
    showSaveMessage(success ? 'success' : 'error', success ? 'Channel configuration saved' : 'Failed to save channel configuration');
  };

  const handleEntryTemplateSave = async () => {
    if (!entryTemplate) return;
    setSaving(true);
    const success = await updateConfig('entrySignalTemplate', entryTemplate as unknown as Record<string, unknown>);
    setSaving(false);
    showSaveMessage(success ? 'success' : 'error', success ? 'Entry template saved' : 'Failed to save entry template');
  };

  const handleSltpTemplateSave = async () => {
    if (!sltpTemplate) return;
    setSaving(true);
    const success = await updateConfig('sltpSignalTemplate', sltpTemplate as unknown as Record<string, unknown>);
    setSaving(false);
    showSaveMessage(success ? 'success' : 'error', success ? 'SL/TP template saved' : 'Failed to save SL/TP template');
  };

  const handleTradingSave = async () => {
    setSaving(true);
    const success = await updateConfig('trading', tradingConfig);
    setSaving(false);
    showSaveMessage(success ? 'success' : 'error', success ? 'Trading configuration saved' : 'Failed to save trading configuration');
  };

  const handlePriceFeedSave = async () => {
    setSaving(true);
    const success = await updateConfig('priceFeed', priceFeedConfig);
    setSaving(false);
    showSaveMessage(success ? 'success' : 'error', success ? 'Price feed configuration saved' : 'Failed to save price feed configuration');
  };

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    {
      id: 'channel',
      label: 'Channel',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.44-.42-1.38-.88.03-.24.37-.49 1.03-.74 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.89 5.17-1.9.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.26z"/>
        </svg>
      ),
    },
    {
      id: 'entry',
      label: 'Entry',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 11V9a2 2 0 114 0v2m0 4h-4m8-4a8 8 0 11-16 0 8 8 0 0116 0z" />
        </svg>
      ),
    },
    {
      id: 'sltp',
      label: 'SL/TP',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'price',
      label: 'Price',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      id: 'trading',
      label: 'Trading',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'tester',
      label: 'Tester',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-primary">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Configuration</h2>
            <p className="text-xs text-text-muted">Manage your trading settings</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-text-muted hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Save Message Toast */}
      {saveMessage && (
        <div className={`mx-5 mt-4 p-3 rounded-lg flex items-center gap-2 animate-slide-down ${
          saveMessage.type === 'success' 
            ? 'bg-success/20 border border-success/30 text-success' 
            : 'bg-error/20 border border-error/30 text-error'
        }`}>
          {saveMessage.type === 'success' ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-sm font-medium">{saveMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-5 pb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white/10 text-primary border-b-2 border-primary'
                : 'text-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 pt-4">
        {error && (
          <div className="mb-5 p-4 bg-error/20 border border-error/30 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 text-error flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-error text-sm">{error}</span>
          </div>
        )}

        {/* Channel Tab */}
        {activeTab === 'channel' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Telegram Channel</h3>
              <p className="text-sm text-text-muted mb-5">Configure the Telegram channel to monitor for signals</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Channel ID
                  </label>
                  <input
                    type="text"
                    value={channelConfig.channelId}
                    onChange={(e) => setChannelConfig(prev => ({ ...prev, channelId: e.target.value }))}
                    className="input-field w-full"
                    placeholder="-1001234567890"
                  />
                  <p className="mt-2 text-xs text-text-muted">
                    The ID of the Telegram channel (e.g., -1001234567890)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={channelConfig.channelName}
                    onChange={(e) => setChannelConfig(prev => ({ ...prev, channelName: e.target.value }))}
                    className="input-field w-full"
                    placeholder="XAU Signals Pro"
                  />
                  <p className="mt-2 text-xs text-text-muted">
                    Display name for your reference
                  </p>
                </div>

                <button
                  onClick={handleChannelSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entry Template Tab */}
        {activeTab === 'entry' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Entry Signal Template</h3>
                <p className="text-sm text-text-muted">Define how entry signals are parsed</p>
              </div>
              <button
                onClick={() => setAdvancedMode(prev => ({ ...prev, entry: !prev.entry }))}
                className="text-sm text-primary hover:text-primary-dark transition-colors"
              >
                {advancedMode.entry ? 'Hide Advanced' : 'Show Advanced'}
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={entryTemplate.description}
                  onChange={(e) => setEntryTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field w-full"
                />
              </div>

              {advancedMode.entry ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      Match Type
                    </label>
                    <select
                      value={entryTemplate.matchType || 'regex'}
                      onChange={(e) => setEntryTemplate(prev => ({ ...prev, matchType: e.target.value as MatchType }))}
                      className="input-field w-full"
                    >
                      <option value="regex">Regex (Advanced Pattern Matching)</option>
                      <option value="startswith">Starts With</option>
                      <option value="endswith">Ends With</option>
                      <option value="contains">Contains</option>
                    </select>
                  </div>

                  {(entryTemplate.matchType || 'regex') === 'regex' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          Regex Pattern
                        </label>
                        <input
                          type="text"
                          value={entryTemplate.pattern}
                          onChange={(e) => setEntryTemplate(prev => ({ ...prev, pattern: e.target.value }))}
                          className="input-field w-full font-mono text-sm"
                          placeholder="^(gold|xau)\\s+(buy|sell)\\s+([\\d.]+)$"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          Flags
                        </label>
                        <input
                          type="text"
                          value={entryTemplate.flags}
                          onChange={(e) => setEntryTemplate(prev => ({ ...prev, flags: e.target.value }))}
                          className="input-field w-full font-mono text-sm"
                          placeholder="i"
                        />
                      </div>
                    </>
                  )}

                  {entryTemplate.matchType && entryTemplate.matchType !== 'regex' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          Match Value
                        </label>
                        <input
                          type="text"
                          value={entryTemplate.matchValue}
                          onChange={(e) => setEntryTemplate(prev => ({ ...prev, matchValue: e.target.value }))}
                          className="input-field w-full font-mono text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="entry-case-sensitive"
                          checked={entryTemplate.caseSensitive || false}
                          onChange={(e) => setEntryTemplate(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                          className="w-4 h-4 rounded border-border-color bg-background text-primary focus:ring-primary"
                        />
                        <label htmlFor="entry-case-sensitive" className="text-sm text-text-muted">
                          Case Sensitive
                        </label>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      Extraction Rules (JSON)
                    </label>
                    <textarea
                      value={JSON.stringify(entryTemplate.extractionRules, null, 2)}
                      onChange={(e) => {
                        try {
                          const rules = JSON.parse(e.target.value);
                          setEntryTemplate(prev => ({ ...prev, extractionRules: rules }));
                        } catch {}
                      }}
                      className="input-field w-full font-mono text-sm h-48 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-2">
                  <p className="text-sm">
                    <span className="text-text-muted">Match Type:</span>{' '}
                    <span className="text-primary font-medium">{entryTemplate.matchType || 'regex'}</span>
                  </p>
                  {(entryTemplate.matchType || 'regex') === 'regex' ? (
                    <>
                      <p className="text-sm">
                        <span className="text-text-muted">Pattern:</span>{' '}
                        <code className="text-primary font-mono">{entryTemplate.pattern || 'Not set'}</code>
                      </p>
                      <p className="text-sm">
                        <span className="text-text-muted">Flags:</span>{' '}
                        <span className="text-white">{entryTemplate.flags || 'none'}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        <span className="text-text-muted">Match Value:</span>{' '}
                        <code className="text-primary font-mono">{entryTemplate.matchValue || 'Not set'}</code>
                      </p>
                      <p className="text-sm">
                        <span className="text-text-muted">Case Sensitive:</span>{' '}
                        <span className="text-white">{entryTemplate.caseSensitive ? 'Yes' : 'No'}</span>
                      </p>
                    </>
                  )}
                  <p className="text-sm">
                    <span className="text-text-muted">Extraction Rules:</span>{' '}
                    <span className="text-white">
                      {Object.keys(entryTemplate.extractionRules).length > 0 
                        ? Object.keys(entryTemplate.extractionRules).join(', ') 
                        : 'None'}
                    </span>
                  </p>
                </div>
              )}

              <button
                onClick={handleEntryTemplateSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        )}

        {/* SL/TP Template Tab */}
        {activeTab === 'sltp' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">SL/TP Signal Template</h3>
                <p className="text-sm text-text-muted">Define how SL/TP updates are parsed</p>
              </div>
              <button
                onClick={() => setAdvancedMode(prev => ({ ...prev, sltp: !prev.sltp }))}
                className="text-sm text-primary hover:text-primary-dark transition-colors"
              >
                {advancedMode.sltp ? 'Hide Advanced' : 'Show Advanced'}
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={sltpTemplate.description}
                  onChange={(e) => setSltpTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field w-full"
                />
              </div>

              {advancedMode.sltp ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      Match Type
                    </label>
                    <select
                      value={sltpTemplate.matchType || 'regex'}
                      onChange={(e) => setSltpTemplate(prev => ({ ...prev, matchType: e.target.value as MatchType }))}
                      className="input-field w-full"
                    >
                      <option value="regex">Regex (Advanced Pattern Matching)</option>
                      <option value="startswith">Starts With</option>
                      <option value="endswith">Ends With</option>
                      <option value="contains">Contains</option>
                    </select>
                  </div>

                  {(sltpTemplate.matchType || 'regex') === 'regex' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          Regex Pattern
                        </label>
                        <input
                          type="text"
                          value={sltpTemplate.pattern}
                          onChange={(e) => setSltpTemplate(prev => ({ ...prev, pattern: e.target.value }))}
                          className="input-field w-full font-mono text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          Flags
                        </label>
                        <input
                          type="text"
                          value={sltpTemplate.flags}
                          onChange={(e) => setSltpTemplate(prev => ({ ...prev, flags: e.target.value }))}
                          className="input-field w-full font-mono text-sm"
                        />
                      </div>
                    </>
                  )}

                  {sltpTemplate.matchType && sltpTemplate.matchType !== 'regex' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">
                          Match Value
                        </label>
                        <input
                          type="text"
                          value={sltpTemplate.matchValue}
                          onChange={(e) => setSltpTemplate(prev => ({ ...prev, matchValue: e.target.value }))}
                          className="input-field w-full font-mono text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sltp-case-sensitive"
                          checked={sltpTemplate.caseSensitive || false}
                          onChange={(e) => setSltpTemplate(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                          className="w-4 h-4 rounded border-border-color bg-background text-primary focus:ring-primary"
                        />
                        <label htmlFor="sltp-case-sensitive" className="text-sm text-text-muted">
                          Case Sensitive
                        </label>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                      Extraction Rules (JSON)
                    </label>
                    <textarea
                      value={JSON.stringify(sltpTemplate.extractionRules, null, 2)}
                      onChange={(e) => {
                        try {
                          const rules = JSON.parse(e.target.value);
                          setSltpTemplate(prev => ({ ...prev, extractionRules: rules }));
                        } catch {}
                      }}
                      className="input-field w-full font-mono text-sm h-48 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-2">
                  <p className="text-sm">
                    <span className="text-text-muted">Match Type:</span>{' '}
                    <span className="text-primary font-medium">{sltpTemplate.matchType || 'regex'}</span>
                  </p>
                  {(sltpTemplate.matchType || 'regex') === 'regex' ? (
                    <>
                      <p className="text-sm">
                        <span className="text-text-muted">Pattern:</span>{' '}
                        <code className="text-primary font-mono">{sltpTemplate.pattern || 'Not set'}</code>
                      </p>
                      <p className="text-sm">
                        <span className="text-text-muted">Flags:</span>{' '}
                        <span className="text-white">{sltpTemplate.flags || 'none'}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        <span className="text-text-muted">Match Value:</span>{' '}
                        <code className="text-primary font-mono">{sltpTemplate.matchValue || 'Not set'}</code>
                      </p>
                      <p className="text-sm">
                        <span className="text-text-muted">Case Sensitive:</span>{' '}
                        <span className="text-white">{sltpTemplate.caseSensitive ? 'Yes' : 'No'}</span>
                      </p>
                    </>
                  )}
                  <p className="text-sm">
                    <span className="text-text-muted">Extraction Rules:</span>{' '}
                    <span className="text-white">
                      {Object.keys(sltpTemplate.extractionRules).length > 0 
                        ? Object.keys(sltpTemplate.extractionRules).join(', ') 
                        : 'None'}
                    </span>
                  </p>
                </div>
              )}

              <button
                onClick={handleSltpTemplateSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        )}

        {/* Price Feed Tab */}
        {activeTab === 'price' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Price Feed</h3>
              <p className="text-sm text-text-muted mb-5">Configure price data polling settings</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Polling Interval (milliseconds)
                </label>
                <input
                  type="number"
                  value={priceFeedConfig.pollingIntervalMs}
                  onChange={(e) => setPriceFeedConfig(prev => ({ ...prev, pollingIntervalMs: parseInt(e.target.value) || 1000 }))}
                  className="input-field w-full"
                  min={500}
                  max={10000}
                  step={100}
                />
                <p className="mt-2 text-xs text-text-muted">
                  How often to fetch price data (500ms - 10000ms)
                </p>
                <div className="mt-4">
                  <input
                    type="range"
                    value={priceFeedConfig.pollingIntervalMs}
                    onChange={(e) => setPriceFeedConfig(prev => ({ ...prev, pollingIntervalMs: parseInt(e.target.value) || 1000 }))}
                    className="w-full accent-primary"
                    min={500}
                    max={10000}
                    step={100}
                  />
                  <div className="flex justify-between text-xs text-text-muted mt-2">
                    <span>500ms</span>
                    <span>10000ms</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePriceFeedSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

        {/* Trading Tab */}
        {activeTab === 'trading' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Trading Settings</h3>
              <p className="text-sm text-text-muted mb-5">Configure default trading parameters</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Default Lot Size
                </label>
                <input
                  type="number"
                  value={tradingConfig.defaultLotSize}
                  onChange={(e) => setTradingConfig(prev => ({ ...prev, defaultLotSize: parseFloat(e.target.value) || 0.1 }))}
                  className="input-field w-full"
                  min={0.01}
                  step={0.01}
                />
                <p className="mt-2 text-xs text-text-muted">
                  Position size for new trades (e.g., 0.1 lot)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  SL/TP Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={tradingConfig.slTpTimeoutMinutes}
                  onChange={(e) => setTradingConfig(prev => ({ ...prev, slTpTimeoutMinutes: parseInt(e.target.value) || 3 }))}
                  className="input-field w-full"
                  min={1}
                />
                <p className="mt-2 text-xs text-text-muted">
                  Auto-close trades missing SL/TP after this many minutes
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">
                  Entry Price Tolerance
                </label>
                <input
                  type="number"
                  value={tradingConfig.entryPriceTolerance}
                  onChange={(e) => setTradingConfig(prev => ({ ...prev, entryPriceTolerance: parseFloat(e.target.value) || 2 }))}
                  className="input-field w-full"
                  min={0}
                  step={0.01}
                />
                <p className="mt-2 text-xs text-text-muted">
                  Accept entry signals within ±this value from current price (e.g., 2.0 means ±2.00)
                </p>
              </div>

              <button
                onClick={handleTradingSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

        {/* Template Tester Tab */}
        {activeTab === 'tester' && config && (
          <div className="animate-slide-up">
            <TemplateTester
              entryTemplate={config.entrySignalTemplate}
              sltpTemplate={config.sltpSignalTemplate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
