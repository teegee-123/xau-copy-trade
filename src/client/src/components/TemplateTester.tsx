import { useState, useCallback } from 'react';
import { useConfig } from '../hooks/useConfig';
import type { SignalTemplate, TemplateTestResult, HistoricalMessage } from '../types';

interface TemplateTesterProps {
  entryTemplate: SignalTemplate;
  sltpTemplate: SignalTemplate;
}

export function TemplateTester({ entryTemplate, sltpTemplate }: TemplateTesterProps) {
  const { testTemplate, getHistoricalMessages, getTemplateExamples } = useConfig();
  
  const [templateType, setTemplateType] = useState<'entry' | 'sltp'>('entry');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<TemplateTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [historicalMessages, setHistoricalMessages] = useState<HistoricalMessage[]>([]);
  const [examples, setExamples] = useState<{ entry: Array<{ message: string; extracted: Record<string, unknown> }>; sltp: Array<{ message: string; extracted: Record<string, unknown> }> } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const handleTest = useCallback(async () => {
    if (!testMessage.trim()) return;
    
    setTesting(true);
    const template = templateType === 'entry' ? entryTemplate : sltpTemplate;
    const result = await testTemplate(templateType, testMessage, template as unknown as Record<string, unknown>);
    setTestResult(result);
    setTesting(false);
  }, [testMessage, templateType, testTemplate, entryTemplate, sltpTemplate]);

  const handleLoadHistorical = useCallback(async () => {
    const messages = await getHistoricalMessages(10);
    setHistoricalMessages(messages);
    setShowHistory(true);
  }, [getHistoricalMessages]);

  const handleLoadExamples = useCallback(async () => {
    const exs = await getTemplateExamples();
    setExamples(exs);
    setShowExamples(true);
  }, [getTemplateExamples]);

  const handleSelectHistorical = useCallback((msg: HistoricalMessage) => {
    // Create a sample message based on the trade
    const action = msg.action.toLowerCase();
    const sampleMsg = `${action} ${msg.symbol} at ${msg.entryPrice}`;
    setTestMessage(sampleMsg);
    setShowHistory(false);
  }, []);

  const handleSelectExample = useCallback((message: string) => {
    setTestMessage(message);
    setShowExamples(false);
  }, []);

  const currentExamples = examples ? examples[templateType] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Template Tester</h3>
        
        {/* Template Type Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => { setTemplateType('entry'); setTestResult(null); }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              templateType === 'entry'
                ? 'bg-primary text-black'
                : 'bg-background border border-border-color text-text-muted hover:text-white'
            }`}
          >
            Entry Template
          </button>
          <button
            onClick={() => { setTemplateType('sltp'); setTestResult(null); }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              templateType === 'sltp'
                ? 'bg-primary text-black'
                : 'bg-background border border-border-color text-text-muted hover:text-white'
            }`}
          >
            SL/TP Template
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleLoadExamples}
          className="btn-secondary text-sm"
        >
          Load Examples
        </button>
        <button
          onClick={handleLoadHistorical}
          className="btn-secondary text-sm"
        >
          Load Historical Trades
        </button>
      </div>

      {/* Examples Panel */}
      {showExamples && examples && (
        <div className="border border-border-color rounded p-4 bg-background">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">
              {templateType === 'entry' ? 'Entry' : 'SL/TP'} Template Examples
            </h4>
            <button
              onClick={() => setShowExamples(false)}
              className="text-text-muted hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {currentExamples.length === 0 ? (
              <p className="text-sm text-text-muted">No examples available</p>
            ) : (
              currentExamples.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-background-card rounded border border-border-color cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectExample(ex.message)}
                >
                  <p className="text-sm text-white font-mono">{ex.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Historical Messages Panel */}
      {showHistory && (
        <div className="border border-border-color rounded p-4 bg-background">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">Historical Trades</h4>
            <button
              onClick={() => setShowHistory(false)}
              className="text-text-muted hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {historicalMessages.length === 0 ? (
              <p className="text-sm text-text-muted">No historical trades found</p>
            ) : (
              historicalMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-2 bg-background-card rounded border border-border-color cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelectHistorical(msg)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-medium px-1 rounded ${
                        msg.action === 'BUY' ? 'bg-success text-black' : 'bg-error text-white'
                      }`}>
                        {msg.action}
                      </span>
                      <span className="text-sm text-white ml-2">{msg.symbol}</span>
                    </div>
                    <span className="text-sm text-text-muted">@{msg.entryPrice}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Test Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-muted">
          Test Message
        </label>
        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          className="w-full bg-background border border-border-color rounded px-3 py-2 text-white focus:outline-none focus:border-primary h-32 font-mono text-sm"
          placeholder="Enter a test message to validate against the template..."
        />
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !testMessage.trim()}
            className="btn-primary"
          >
            {testing ? 'Testing...' : 'Test Template'}
          </button>
          <button
            onClick={() => { setTestMessage(''); setTestResult(null); }}
            className="btn-secondary"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className={`border rounded p-4 ${
          testResult.matched 
            ? 'border-success bg-success bg-opacity-10' 
            : testResult.error 
              ? 'border-error bg-error bg-opacity-10'
              : 'border-warning bg-warning bg-opacity-10'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {testResult.matched ? (
              <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : testResult.error ? (
              <svg className="w-5 h-5 text-error" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`font-medium ${
              testResult.matched 
                ? 'text-success' 
                : testResult.error 
                  ? 'text-error'
                  : 'text-warning'
            }`}>
              {testResult.matched 
                ? 'Template Matched!' 
                : testResult.error 
                  ? `Error: ${testResult.error}`
                  : 'No Match - Template did not match the test message'}
            </span>
          </div>

          {testResult.matched && testResult.extracted && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Extracted Values:</h4>
              <pre className="bg-background rounded p-3 text-sm text-white font-mono overflow-x-auto">
                {JSON.stringify(testResult.extracted, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Current Template Info */}
      <div className="border border-border-color rounded p-4 bg-background">
        <h4 className="text-sm font-medium text-white mb-2">
          Current {templateType === 'entry' ? 'Entry' : 'SL/TP'} Template
        </h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-text-muted">Match Type: </span>
            <span className="text-white capitalize">
              {templateType === 'entry' ? (entryTemplate.matchType || 'regex') : (sltpTemplate.matchType || 'regex')}
            </span>
          </div>
          {(templateType === 'entry' ? entryTemplate.matchType : sltpTemplate.matchType) === 'regex' ? (
            <>
              <div>
                <span className="text-text-muted">Pattern: </span>
                <code className="text-primary font-mono">
                  {templateType === 'entry' ? entryTemplate.pattern : sltpTemplate.pattern}
                </code>
              </div>
              <div>
                <span className="text-text-muted">Flags: </span>
                <span className="text-white">
                  {templateType === 'entry' ? entryTemplate.flags : sltpTemplate.flags}
                </span>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-text-muted">Match Value: </span>
                <code className="text-primary font-mono">
                  {templateType === 'entry' ? entryTemplate.matchValue : sltpTemplate.matchValue}
                </code>
              </div>
              <div>
                <span className="text-text-muted">Case Sensitive: </span>
                <span className="text-white">
                  {templateType === 'entry' ? (entryTemplate.caseSensitive ? 'Yes' : 'No') : (sltpTemplate.caseSensitive ? 'Yes' : 'No')}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
