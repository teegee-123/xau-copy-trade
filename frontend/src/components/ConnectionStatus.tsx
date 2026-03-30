
interface ConnectionStatusProps {
  telegram: { connected: boolean; error?: string };
  price_feed: { connected: boolean; error?: string };
  websocketConnected: boolean;
}

export function ConnectionStatus({ telegram, price_feed, websocketConnected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Telegram */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          telegram.connected ? 'bg-green-400 animate-pulse-dot' : 'bg-red-400'
        }`} />
        <span className="text-sm text-slate-300">Telegram</span>
        {telegram.error && (
          <span className="text-xs text-red-400" title={telegram.error}>!</span>
        )}
      </div>

      {/* Price Feed */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          price_feed.connected ? 'bg-green-400 animate-pulse-dot' : 'bg-red-400'
        }`} />
        <span className="text-sm text-slate-300">Price Feed</span>
        {price_feed.error && (
          <span className="text-xs text-red-400" title={price_feed.error}>!</span>
        )}
      </div>

      {/* WebSocket */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          websocketConnected ? 'bg-green-400 animate-pulse-dot' : 'bg-red-400'
        }`} />
        <span className="text-sm text-slate-300">Dashboard</span>
      </div>
    </div>
  );
}

export default ConnectionStatus;
