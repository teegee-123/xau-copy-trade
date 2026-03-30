import { useState } from 'react';
import { TradeProvider, useTradeContext } from './context/TradeContext';
import { SummaryCards } from './components/ui/SummaryCards';
import { Tab } from './components/ui/Tab';
import ActiveTrades from './components/ActiveTrades';
import TradeHistory from './components/TradeHistory';
import BotControls from './components/BotControls';
import ConnectionStatus from './components/ConnectionStatus';

type TabType = 'active' | 'pending' | 'history';

function Dashboard() {
  const {
    activeTrades,
    pendingTrades,
    closedTrades,
    summary,
    botStatus,
    connectionStatus,
    isLoading,
    error,
    isWebSocketConnected,
  } = useTradeContext();

  const [activeTab, setActiveTab] = useState<TabType>('active');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading data</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">XAU Copy Trade</h1>
              <p className="text-slate-400 text-sm">Paper Trading Dashboard</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {connectionStatus && (
                <ConnectionStatus
                  telegram={connectionStatus.telegram}
                  price_feed={connectionStatus.price_feed}
                  websocketConnected={isWebSocketConnected}
                />
              )}

              {botStatus && (
                <BotControls
                  isPaused={botStatus.is_paused}
                  isRunning={botStatus.is_running}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <SummaryCards summary={summary} />

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800">
          <Tab
            active={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
            count={activeTrades.length}
          >
            Active Trades
          </Tab>
          <Tab
            active={activeTab === 'pending'}
            onClick={() => setActiveTab('pending')}
            count={pendingTrades.length}
          >
            Pending
          </Tab>
          <Tab
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          >
            History
          </Tab>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'active' && (
            <ActiveTrades trades={activeTrades} />
          )}

          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingTrades.length === 0 ? (
                <div className="bg-slate-800 rounded-lg p-6 text-center text-slate-400">
                  No pending trades
                </div>
              ) : (
                pendingTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.direction === 'BUY' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.direction}
                        </span>
                        <span className="text-lg font-bold text-white">{trade.symbol}</span>
                      </div>
                      <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
                        PENDING ENTRY
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Max Entry</span>
                        <p className="text-white font-medium">{trade.entry_price_max?.toFixed(2) || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Stop Loss</span>
                        <p className="text-red-400 font-medium">{trade.stop_loss?.toFixed(2) || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Take Profit</span>
                        <p className="text-green-400 font-medium">{trade.take_profit?.toFixed(2) || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Created</span>
                        <p className="text-white font-medium">
                          {new Date(trade.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <TradeHistory trades={closedTrades} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-slate-500 text-sm">
          XAU Copy Trade Dashboard • Paper Trading Only • Not Financial Advice
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <TradeProvider>
      <Dashboard />
    </TradeProvider>
  );
}

export default App;
