import React, { useState, useCallback } from 'react';
import { useConfig } from '../hooks/useConfig';
import { TemplateTester } from './TemplateTester';
import type { SignalTemplate } from '../types';

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
    pattern: '',
    flags: 'i',
    extractionRules: {},
    examples: [],
  });
  const [sltpTemplate, setSltpTemplate] = useState<SignalTemplate>({
    description: '',
    pattern: '',
    flags: 'i',
    extractionRules: {},
    examples: [],
  });
  const [tradingConfig, setTradingConfig] = useState({ defaultLotSize: 0.1, slTpTimeoutMinutes: 5 });
  const [priceFeedConfig, setPriceFeedConfig] = useState({ pollingIntervalMs: 1000 });

  // Sync local state with config
  React.useEffect(() => {
    if (config) {
      setChannelConfig(config.channel);
      setEntryTemplate(config.entrySignalTemplate);
      setSltpTemplate(config.sltpSignalTemplate);
      setTradingConfig(config.trading);
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
      label: 'Entry Template',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'sltp',
      label: 'SL/TP Template',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'price',
      label: 'Price Feed',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
      label: 'Template Tester',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-background-card rounded-lg p-8">
          <div className="animate-pulse text-primary">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-card rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-color">
          <h2 className="text-xl font-bold text-primary">Configuration Settings</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`px-4 py-2 text-sm ${
            saveMessage.type === 'success' ? 'bg-success bg-opacity-20 text-success' : 'bg-error bg-opacity-20 text-error'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border-color overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-error bg-opacity-20 text-error rounded text-sm">
              {error}
            </div>
          )}

          {/* Channel Tab */}
          {activeTab === 'channel' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Telegram Channel Configuration</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">
                      Channel ID
                    </label>
                    <input
                      type="text"
                      value={channelConfig.channelId}
                      onChange={(e) => setChannelConfig(prev => ({ ...prev, channelId: e.target.value }))}
                      className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                      placeholder="-1001234567890"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      The ID of the Telegram channel to monitor for signals (e.g., -1001234567890)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      value={channelConfig.channelName}
                      onChange={(e) => setChannelConfig(prev => ({ ...prev, channelName: e.target.value }))}
                      className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                      placeholder="XAU Signals Pro"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Display name for the channel (for your reference)
                    </p>
                  </div>

                  <button
                    onClick={handleChannelSave}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save Channel Configuration'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Entry Template Tab */}
          {activeTab === 'entry' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Entry Signal Template</h3>
                <button
                  onClick={() => setAdvancedMode(prev => ({ ...prev, entry: !prev.entry }))}
                  className="text-sm text-primary hover:text-primary-light"
                >
                  {advancedMode.entry ? 'Hide Advanced' : 'Show Advanced'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={entryTemplate.description}
                    onChange={(e) => setEntryTemplate(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                {advancedMode.entry ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
                        Regex Pattern
                      </label>
                      <input
                        type="text"
                        value={entryTemplate.pattern}
                        onChange={(e) => setEntryTemplate(prev => ({ ...prev, pattern: e.target.value }))}
                        className="w-full bg-background border border-border-color rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary"
                        placeholder="^(gold|xau)\\s+(buy|sell)\\s+([\\d.]+)$"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        JavaScript regex pattern to match entry signals
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
                        Flags
                      </label>
                      <input
                        type="text"
                        value={entryTemplate.flags}
                        onChange={(e) => setEntryTemplate(prev => ({ ...prev, flags: e.target.value }))}
                        className="w-full bg-background border border-border-color rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary"
                        placeholder="i"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Regex flags (e.g., 'i' for case-insensitive)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
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
                        className="w-full bg-background border border-border-color rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary h-48"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Define how to extract fields from regex capture groups
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-background rounded border border-border-color">
                    <p className="text-sm text-text-muted">
                      <strong>Pattern:</strong> <code className="text-primary">{entryTemplate.pattern || 'Not set'}</code>
                    </p>
                    <p className="text-sm text-text-muted mt-2">
                      <strong>Flags:</strong> {entryTemplate.flags || 'none'}
                    </p>
                    <p className="text-sm text-text-muted mt-2">
                      <strong>Extraction Rules:</strong> {Object.keys(entryTemplate.extractionRules).length > 0 ? Object.keys(entryTemplate.extractionRules).join(', ') : 'None'}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleEntryTemplateSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Entry Template'}
                </button>
              </div>
            </div>
          )}

          {/* SL/TP Template Tab */}
          {activeTab === 'sltp' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">SL/TP Signal Template</h3>
                <button
                  onClick={() => setAdvancedMode(prev => ({ ...prev, sltp: !prev.sltp }))}
                  className="text-sm text-primary hover:text-primary-light"
                >
                  {advancedMode.sltp ? 'Hide Advanced' : 'Show Advanced'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={sltpTemplate.description}
                    onChange={(e) => setSltpTemplate(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                {advancedMode.sltp ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
                        Regex Pattern
                      </label>
                      <input
                        type="text"
                        value={sltpTemplate.pattern}
                        onChange={(e) => setSltpTemplate(prev => ({ ...prev, pattern: e.target.value }))}
                        className="w-full bg-background border border-border-color rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        JavaScript regex pattern to match SL/TP update signals
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
                        Flags
                      </label>
                      <input
                        type="text"
                        value={sltpTemplate.flags}
                        onChange={(e) => setSltpTemplate(prev => ({ ...prev, flags: e.target.value }))}
                        className="w-full bg-background border border-border-color rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Regex flags (e.g., 'i' for case-insensitive)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">
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
                        className="w-full bg-background border border-border-color rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary h-48"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Define how to extract fields from regex capture groups
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-background rounded border border-border-color">
                    <p className="text-sm text-text-muted">
                      <strong>Pattern:</strong> <code className="text-primary">{sltpTemplate.pattern || 'Not set'}</code>
                    </p>
                    <p className="text-sm text-text-muted mt-2">
                      <strong>Flags:</strong> {sltpTemplate.flags || 'none'}
                    </p>
                    <p className="text-sm text-text-muted mt-2">
                      <strong>Extraction Rules:</strong> {Object.keys(sltpTemplate.extractionRules).length > 0 ? Object.keys(sltpTemplate.extractionRules).join(', ') : 'None'}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSltpTemplateSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : 'Save SL/TP Template'}
                </button>
              </div>
            </div>
          )}

          {/* Price Feed Tab */}
          {activeTab === 'price' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Price Feed Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">
                    Polling Interval (milliseconds)
                  </label>
                  <input
                    type="number"
                    value={priceFeedConfig.pollingIntervalMs}
                    onChange={(e) => setPriceFeedConfig(prev => ({ ...prev, pollingIntervalMs: parseInt(e.target.value) || 1000 }))}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                    min={500}
                    max={10000}
                    step={100}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    How often to pull price from the price service (500ms - 10000ms)
                  </p>
                  <div className="mt-2">
                    <input
                      type="range"
                      value={priceFeedConfig.pollingIntervalMs}
                      onChange={(e) => setPriceFeedConfig(prev => ({ ...prev, pollingIntervalMs: parseInt(e.target.value) || 1000 }))}
                      className="w-full"
                      min={500}
                      max={10000}
                      step={100}
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-1">
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
                  {saving ? 'Saving...' : 'Save Price Feed Configuration'}
                </button>
              </div>
            </div>
          )}

          {/* Trading Tab */}
          {activeTab === 'trading' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white">Trading Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">
                    Default Lot Size
                  </label>
                  <input
                    type="number"
                    value={tradingConfig.defaultLotSize}
                    onChange={(e) => setTradingConfig(prev => ({ ...prev, defaultLotSize: parseFloat(e.target.value) || 0.1 }))}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                    min={0.01}
                    step={0.01}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Position size for new trades (e.g., 0.1 lot)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">
                    SL/TP Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={tradingConfig.slTpTimeoutMinutes}
                    onChange={(e) => setTradingConfig(prev => ({ ...prev, slTpTimeoutMinutes: parseInt(e.target.value) || 5 }))}
                    className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                    min={1}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Time after which trades missing SL/TP are marked as faulted
                  </p>
                </div>

                <button
                  onClick={handleTradingSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Trading Configuration'}
                </button>
              </div>
            </div>
          )}

          {/* Template Tester Tab */}
          {activeTab === 'tester' && config && (
            <TemplateTester
              entryTemplate={config.entrySignalTemplate}
              sltpTemplate={config.sltpSignalTemplate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
