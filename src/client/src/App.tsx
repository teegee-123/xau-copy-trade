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
    if (confirm('Close all trades missing SL/TP after 5 minutes?')) {
      await closeFaultedTrades();
    }
  };

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <header className="border-b border-border-color bg-background-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary">XAU Copy Trade</h1>
                <p className="text-xs text-text-muted">Paper Trading Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setShowConfig(true)}
                className="btn-secondary text-sm"
                title="Configuration Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Config Panel Modal */}
      {showConfig && (
        <ConfigPanel onClose={() => setShowConfig(false)} />
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Status Bar */}
        <div className="mb-6">
          <StatusChips status={systemStatus} loading={statusLoading} />
        </div>

        {/* Price Display */}
        <div className="mb-6">
          <PriceDisplay 
            price={price} 
            loading={priceLoading} 
            warning={systemStatus?.price.warning}
          />
        </div>

        {/* P&L Display */}
        <div className="mb-6">
          <PnLDisplay />
        </div>

        {/* Equity Chart */}
        <div className="mb-6">
          <EquityChart range={equityRange} onRangeChange={setEquityRange} />
        </div>

        {/* Open Trades */}
        <div className="mb-6">
          <OpenTradesTable
            trades={openTrades}
            onCloseTrade={handleManualClose}
            loading={tradesLoading}
          />

          {openTrades.some(t => t.status === 'FAULTED' || t.status === 'PENDING_SL_TP') && (
            <div className="mt-4">
              <button onClick={handleFaultedClose} className="btn-danger w-full sm:w-auto">
                Auto Close All Faulted Trades
              </button>
            </div>
          )}
        </div>

        {/* Trade History */}
        <div className="mb-6">
          <TradeHistory trades={closedTrades} loading={tradesLoading} />
        </div>

        {/* Logs (conditional) */}
        {showLogs && (
          <div className="mb-6">
            <LogViewer />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-color bg-background-card mt-12">
        <div className="container mx-auto px-4 py-4 text-center text-text-muted text-sm">
          XAU Copy Trade Dashboard • Paper Trading Mode
        </div>
      </footer>
    </div>
  );
}

export default App;
