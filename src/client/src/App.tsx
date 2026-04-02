import { useState } from 'react';
import { PriceDisplay } from './components/PriceDisplay';
import { StatusChips } from './components/StatusChips';
import { PnLDisplay } from './components/PnLDisplay';
import { OpenTradesTable } from './components/OpenTradesTable';
import { TradeHistory } from './components/TradeHistory';
import { EquityChart } from './components/EquityChart';
import { LogViewer } from './components/LogViewer';
import { ConfigPanel } from './components/ConfigPanel';
import { usePrice } from './hooks/usePrice';
import { useTrades } from './hooks/useTrades';
import { useSystemStatus } from './hooks/useSystemStatus';

function App() {
  const { price, loading: priceLoading } = usePrice();
  const { status: systemStatus, loading: statusLoading } = useSystemStatus();
  const { openTrades, closedTrades, loading: tradesLoading, closeTrade, closeFaultedTrades } = useTrades();
  const [equityRange, setEquityRange] = useState<'1D' | '1W' | '1M' | 'ALL'>('1W');
  const [showLogs, setShowLogs] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const handleManualClose = async (tradeId: number) => {
    await closeTrade(tradeId, 'MANUAL_CLOSE');
  };

  const handleFaultedClose = async () => {
    if (confirm('Close all trades missing SL/TP after 3 minutes?')) {
      await closeFaultedTrades();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0d1117] to-[#0a0a0a]">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-10 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text tracking-tight">XAU Copy Trade</h1>
                <p className="text-xs text-text-muted">Paper Trading Dashboard</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowConfig(true)}
                className="btn-secondary text-sm flex items-center gap-2"
                title="Configuration Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Config</span>
              </button>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">{showLogs ? 'Hide Logs' : 'Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Config Panel Modal */}
      {showConfig && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-content w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <ConfigPanel onClose={() => setShowConfig(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Status Bar */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <StatusChips status={systemStatus} loading={statusLoading} />
        </div>

        {/* Price Display */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <PriceDisplay
            price={price}
            loading={priceLoading}
            warning={systemStatus?.price.warning}
          />
        </div>

        {/* P&L Display */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <PnLDisplay />
        </div>

        {/* Equity Chart & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <EquityChart range={equityRange} onRangeChange={setEquityRange} />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            {/* Quick Stats Card */}
            <div className="card h-full">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-text-muted text-sm">Open Trades</span>
                  <span className="text-white font-semibold">{openTrades.length}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-text-muted text-sm">Closed Trades</span>
                  <span className="text-white font-semibold">{closedTrades.length}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/5">
                  <span className="text-text-muted text-sm">Win Rate</span>
                  <span className="text-primary font-semibold">
                    {closedTrades.length > 0 
                      ? Math.round((closedTrades.filter(t => (t.pnlUsd || 0) > 0).length / closedTrades.length) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-text-muted text-sm">Pending SL/TP</span>
                  <span className="text-warning font-semibold">
                    {openTrades.filter(t => !t.stopLoss || !t.takeProfit).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Open Trades */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '250ms' }}>
          <OpenTradesTable
            trades={openTrades}
            onCloseTrade={handleManualClose}
            loading={tradesLoading}
          />

          {openTrades.some(t => t.status === 'PENDING_SL_TP') && (
            <div className="mt-4">
              <button onClick={handleFaultedClose} className="btn-danger w-full sm:w-auto">
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Close All Trades Missing SL/TP
              </button>
            </div>
          )}
        </div>

        {/* Trade History */}
        <div className="mb-8 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <TradeHistory trades={closedTrades as any} loading={tradesLoading} />
        </div>

        {/* Logs (conditional) */}
        {showLogs && (
          <div className="mb-8 animate-slide-up" style={{ animationDelay: '350ms' }}>
            <LogViewer />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span>XAU Copy Trade Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Paper Trading Mode
              </span>
              <span>•</span>
              <span>Built with React + Tailwind</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
