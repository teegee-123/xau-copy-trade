import { useState } from 'react';
import { PriceDisplay } from './components/PriceDisplay';
import { StatusChips } from './components/StatusChips';
import { PnLDisplay } from './components/PnLDisplay';
import { OpenTradesTable } from './components/OpenTradesTable';
import { TradeHistory } from './components/TradeHistory';
import { EquityChart } from './components/EquityChart';
import { LogViewer } from './components/LogViewer';
import { usePrice } from './hooks/usePrice';
import { useTrades } from './hooks/useTrades';
import { useSystemStatus } from './hooks/useSystemStatus';

function App() {
  const { price, loading: priceLoading } = usePrice();
  const { status: systemStatus, loading: statusLoading } = useSystemStatus();
  const { openTrades, closedTrades, loading: tradesLoading, closeTrade, closeFaultedTrades } = useTrades();
  const [equityRange, setEquityRange] = useState<'1D' | '1W' | '1M' | 'ALL'>('1W');
  const [showLogs, setShowLogs] = useState(false);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary">XAU Copy Trade</h1>
                <p className="text-xs text-text-muted">Paper Trading Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="btn-secondary text-sm"
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Status Bar */}
        <div className="mb-6">
          <StatusChips status={systemStatus} loading={statusLoading} />
        </div>

        {/* Price Display */}
        <div className="mb-6">
          <PriceDisplay price={price} loading={priceLoading} />
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
              <button onClick={handleFaultedClose} className="btn-danger">
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
            <LogViewer autoScroll={true} />
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
