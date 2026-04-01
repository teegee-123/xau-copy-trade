import axios from 'axios';
import logger from '../logger.js';
import { EventEmitter } from 'events';
import { configService } from './configService.js';

const SWISSQUOTE_URL = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD';
const REQUEST_TIMEOUT = 8000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const commonHeaders = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

export interface PriceData {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  timestamp: string;
  source: string;
}

export interface PriceStatus {
  connected: boolean;
  lastPrice: number | null;
  lastUpdate: string | null;
  error?: string;
  warning?: string;
  source: string;
}

/**
 * Swissquote Price Feed Service
 *
 * Fetches XAU/USD prices from Swissquote public API:
 * - Uses first server in response with 'premium' spread profile
 * - Configurable polling interval (200ms - 120s)
 * - Falls back to last known price on API failure with dashboard warning
 */
export class PriceFeedService extends EventEmitter {
  private currentPrice: PriceData | null = null;
  private lastKnownPrice: PriceData | null = null;
  private status: PriceStatus = {
    connected: false,
    lastPrice: null,
    lastUpdate: null,
    source: 'initializing',
  };
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private consecutiveFailures = 0;
  private apiWarning: string | null = null;

  constructor() {
    super();
  }

  getStatus(): PriceStatus {
    return { ...this.status, warning: this.apiWarning || undefined };
  }

  getCurrentPrice(): PriceData | null {
    return this.currentPrice;
  }

  getApiWarning(): string | null {
    return this.apiWarning;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Price feed service already initialized');
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    // Get polling interval from config
    const priceFeedConfig = configService.getPriceFeedConfig();

    // Listen for config changes
    configService.on('priceFeedChange', (newConfig) => {
      const oldInterval = priceFeedConfig.pollingIntervalMs;
      priceFeedConfig.pollingIntervalMs = newConfig.pollingIntervalMs;
      logger.info('Price feed configuration updated', {
        oldInterval,
        newInterval: priceFeedConfig.pollingIntervalMs,
      });
      // Restart polling with new interval
      if (this.initialized && !this.isPolling) {
        this.stopPolling();
        this.startPolling();
      }
    });

    this.initPromise = (async () => {
      logger.info('Initializing Swissquote price feed service...');
      logger.info('API Endpoint:', SWISSQUOTE_URL);

      // Do an initial fetch with timeout
      const initTimeout = Promise.resolve().then(async () => {
        await this.fetchPrice();
      });

      // Race between init and timeout
      await Promise.race([
        initTimeout,
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);

      // If still no price, mark as disconnected
      if (!this.currentPrice) {
        this.status.connected = false;
        this.status.error = 'Initial price fetch failed';
        this.apiWarning = 'Swissquote API unavailable - waiting for retry';
        logger.warn('Initial price fetch failed, will retry on polling interval');
      }

      this.initialized = true;
      this.initPromise = null;

      // Start polling
      this.startPolling();

      logger.info('Price feed service initialized', {
        source: this.status.source,
        price: this.status.lastPrice,
        pollingInterval: priceFeedConfig.pollingIntervalMs,
      });
    })();

    return this.initPromise;
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    const priceFeedConfig = configService.getPriceFeedConfig();

    this.pollingInterval = setInterval(async () => {
      if (!this.isPolling) {
        await this.fetchPrice();
      }
    }, priceFeedConfig.pollingIntervalMs);

    logger.info(`Price polling started at ${priceFeedConfig.pollingIntervalMs}ms interval`);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Price polling stopped');
    }
  }

  /**
   * Parse Swissquote API response
   * Returns bid/ask from first server's 'premium' spread profile
   */
  private parseSwissquoteResponse(data: unknown): { bid: number; ask: number } | null {
    try {
      const response = data as Array<{
        topo?: { platform?: string; server?: string };
        spreadProfilePrices?: Array<{
          spreadProfile: string;
          bidSpread?: number;
          askSpread?: number;
          bid: number;
          ask: number;
        }>;
        ts?: number;
      }>;

      if (!Array.isArray(response) || response.length === 0) {
        logger.debug('Swissquote: Invalid response format - not an array');
        return null;
      }

      // Use first server in response
      const firstServer = response[0];
      
      if (!firstServer.spreadProfilePrices || !Array.isArray(firstServer.spreadProfilePrices)) {
        logger.debug('Swissquote: No spreadProfilePrices in response');
        return null;
      }

      // Find 'premium' spread profile, fallback to first available
      let premiumProfile = firstServer.spreadProfilePrices.find(
        p => p.spreadProfile === 'premium'
      );

      if (!premiumProfile) {
        premiumProfile = firstServer.spreadProfilePrices[0];
        logger.debug('Swissquote: No premium profile, using first available:', premiumProfile.spreadProfile);
      }

      if (!premiumProfile.bid || !premiumProfile.ask) {
        logger.debug('Swissquote: Missing bid/ask in profile');
        return null;
      }

      // Validate price range (XAU/USD should be between $1000 and $5000)
      if (premiumProfile.bid < 1000 || premiumProfile.bid > 5000) {
        logger.debug('Swissquote: Price out of expected range:', premiumProfile.bid);
        return null;
      }

      return {
        bid: premiumProfile.bid,
        ask: premiumProfile.ask,
      };
    } catch (error) {
      logger.debug('Swissquote: Parse error:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private async fetchPrice(): Promise<void> {
    this.isPolling = true;

    try {
      const response = await axios.get(SWISSQUOTE_URL, {
        headers: commonHeaders,
        timeout: REQUEST_TIMEOUT,
        responseType: 'json',
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const priceData = this.parseSwissquoteResponse(response.data);

      if (priceData) {
        const midPrice = (priceData.bid + priceData.ask) / 2;
        const roundedPrice = Math.round(midPrice * 100) / 100;
        const roundedBid = Math.round(priceData.bid * 100) / 100;
        const roundedAsk = Math.round(priceData.ask * 100) / 100;

        const newData: PriceData = {
          symbol: 'XAUUSD',
          price: roundedPrice,
          bid: roundedBid,
          ask: roundedAsk,
          timestamp: new Date().toISOString(),
          source: 'swissquote',
        };

        this.currentPrice = newData;
        this.lastKnownPrice = newData;
        this.status.connected = true;
        this.status.lastPrice = newData.price;
        this.status.lastUpdate = newData.timestamp;
        this.status.source = newData.source;
        this.status.error = undefined;
        this.status.warning = undefined;

        // Clear any previous warning on success
        if (this.apiWarning) {
          logger.info('Swissquote API recovered - clearing warning');
          this.apiWarning = null;
        }

        this.consecutiveFailures = 0;
        this.emit('priceUpdate', newData);
        logger.silly('Price updated', { price: newData.price, source: newData.source });
      } else {
        throw new Error('Failed to parse Swissquote response');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Swissquote price fetch error', { error: errorMessage });

      this.consecutiveFailures++;

      // Set warning on first failure
      if (this.consecutiveFailures === 1) {
        this.apiWarning = `Swissquote API error: ${errorMessage}`;
        this.status.warning = this.apiWarning;
        this.emit('statusChange', {
          type: 'priceFeed',
          status: { connected: false, warning: this.apiWarning },
        });
        logger.warn('Dashboard warning set:', this.apiWarning);
      }

      // Fallback to last known price if available
      if (this.lastKnownPrice) {
        this.currentPrice = {
          ...this.lastKnownPrice,
          timestamp: new Date().toISOString(),
          source: 'swissquote (cached)',
        };
        this.status.lastPrice = this.lastKnownPrice.price;
        this.status.lastUpdate = this.currentPrice.timestamp;
        this.status.connected = false;
        this.status.error = `Using cached price - API failed (${this.consecutiveFailures} consecutive failures)`;
        
        logger.info('Using last known price', {
          price: this.lastKnownPrice.price,
          failures: this.consecutiveFailures,
        });

        // Emit update with cached price
        this.emit('priceUpdate', this.currentPrice);
      } else {
        // No previous price available
        this.status.connected = false;
        this.status.error = `API fetch failed - no cached price available (${errorMessage})`;
      }
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Get price history for charts (in-memory, last 100 points)
   */
  getPriceHistory(points: number = 100): PriceData[] {
    if (!this.currentPrice) {
      return [];
    }
    return Array(points).fill(this.currentPrice);
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    this.stopPolling();
  }
}

export const priceFeedService = new PriceFeedService();
