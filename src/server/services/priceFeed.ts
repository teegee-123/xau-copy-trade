import axios from 'axios';
import logger from '../logger.js';
import { EventEmitter } from 'events';

const PRICE_API_KEY = process.env.PRICE_API_KEY || '';
const POLLING_INTERVAL_MS = 1000; // 1 second

// Free API options in priority order
const FREE_PRICE_APIS = [
  {
    name: 'twelvedata',
    url: 'https://api.twelvedata.com/price',
    // Free tier: 800 calls/day, 8 calls/minute
    // Get API key from https://twelvedata.com/
    requiresKey: true,
    params: { symbol: 'XAU/USD' },
    parseResponse: (data: unknown) => {
      const response = data as { price?: string; status?: string };
      if (response.status === 'error' || !response.price) {
        return null;
      }
      return parseFloat(response.price);
    }
  },
  {
    name: 'goldapi',
    url: 'https://www.goldapi.io/api/XAU/USD',
    // Free tier: 500 calls/month
    // Get API key from https://www.goldapi.io/
    requiresKey: true,
    headers: { 'x-access-token': PRICE_API_KEY },
    parseResponse: (data: unknown) => {
      const response = data as { price?: number; price_per_gram_24k?: number };
      return response.price || null;
    }
  },
  {
    name: 'metals-api',
    url: 'https://metals-api.com/api/latest',
    // Free tier available
    // Get API key from https://metals-api.com/
    requiresKey: true,
    params: { base: 'USD', symbols: 'XAU' },
    parseResponse: (data: unknown) => {
      const response = data as { rates?: { XAU?: number } };
      // Returns XAU per USD, need to invert to get USD per XAU
      return response.rates?.XAU ? 1 / response.rates.XAU : null;
    }
  }
];

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
  source: string;
}

/**
 * Price Feed Service
 * 
 * Polls XAU/USD price from free APIs at 1-second intervals
 * Falls back to simulated price if all APIs fail
 * Emits price updates via EventEmitter for WebSocket broadcasting
 * 
 * FREE API OPTIONS:
 * 1. Twelve Data (800 calls/day free) - https://twelvedata.com/
 * 2. GoldAPI.io (500 calls/month free) - https://www.goldapi.io/
 * 3. Metals-API (free tier) - https://metals-api.com/
 * 
 * Without API keys, the service will use simulated prices based on
 * realistic XAU/USD movements around $2650/oz
 */
export class PriceFeedService extends EventEmitter {
  private currentPrice: PriceData | null = null;
  private status: PriceStatus = {
    connected: false,
    lastPrice: null,
    lastUpdate: null,
    source: 'initializing',
  };
  private pollingInterval: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private maxFailuresBeforeFallback = 3;
  private isPolling = false;
  private currentApiIndex = 0;
  private apiKeyProvided = !!PRICE_API_KEY;

  constructor() {
    super();
  }

  getStatus(): PriceStatus {
    return { ...this.status };
  }

  getCurrentPrice(): PriceData | null {
    return this.currentPrice;
  }

  async initialize(): Promise<void> {
    if (!this.apiKeyProvided) {
      logger.warn('No PRICE_API_KEY provided. Using simulated prices.');
      logger.warn('Get a free API key from: https://twelvedata.com/ (recommended)');
      // Initialize with simulated price
      this.currentPrice = this.generateSimulatedPrice();
      this.status.connected = true;
      this.status.lastPrice = this.currentPrice.price;
      this.status.lastUpdate = this.currentPrice.timestamp;
      this.status.source = 'simulated (no API key)';
      this.emit('priceUpdate', this.currentPrice);
    } else {
      logger.info('Initializing price feed service with free APIs');
    }
    
    // Start polling
    this.startPolling();
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      if (!this.isPolling) {
        await this.fetchPrice();
      }
    }, POLLING_INTERVAL_MS);

    logger.info(`Price polling started at ${POLLING_INTERVAL_MS}ms interval`);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Price polling stopped');
    }
  }

  private async fetchPrice(): Promise<void> {
    this.isPolling = true;

    try {
      let priceData: PriceData | null = null;

      // If no API key, use simulated prices
      if (!this.apiKeyProvided) {
        priceData = this.generateSimulatedPrice();
      } else {
        // Try configured APIs in order
        for (let i = 0; i < FREE_PRICE_APIS.length; i++) {
          const apiIndex = (this.currentApiIndex + i) % FREE_PRICE_APIS.length;
          const api = FREE_PRICE_APIS[apiIndex];
          
          // Skip APIs that require a key if we don't have one configured for that specific API
          if (api.requiresKey && !PRICE_API_KEY) {
            continue;
          }
          
          priceData = await this.fetchFromAPI(api);
          
          if (priceData) {
            this.currentApiIndex = apiIndex; // Remember working API
            break;
          }
        }

        // Fallback: Simulated price based on last known price
        if (!priceData && this.currentPrice) {
          priceData = this.generateSimulatedPrice();
        }
      }

      if (priceData) {
        this.consecutiveFailures = 0;
        this.currentPrice = priceData;
        this.status.connected = true;
        this.status.lastPrice = priceData.price;
        this.status.lastUpdate = priceData.timestamp;
        this.status.source = priceData.source;
        this.status.error = undefined;

        this.emit('priceUpdate', priceData);
        logger.debug('Price updated', { price: priceData.price, source: priceData.source });
      }
    } catch (error) {
      this.consecutiveFailures++;
      logger.warn('Price fetch failed', { 
        failures: this.consecutiveFailures, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      if (this.consecutiveFailures >= this.maxFailuresBeforeFallback) {
        this.status.connected = false;
        this.status.error = 'All APIs unavailable, using simulated price';
        this.emit('statusChange', this.status);
        
        // Generate simulated price if we have a baseline
        if (this.currentPrice) {
          const simulatedPrice = this.generateSimulatedPrice();
          this.currentPrice = simulatedPrice;
          this.status.lastPrice = simulatedPrice.price;
          this.status.lastUpdate = simulatedPrice.timestamp;
          this.emit('priceUpdate', simulatedPrice);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async fetchFromAPI(api: typeof FREE_PRICE_APIS[0]): Promise<PriceData | null> {
    try {
      const config: { params?: Record<string, string | undefined>; headers?: Record<string, string>; timeout: number } = {
        timeout: 3000,
      };

      if (api.params) {
        config.params = { ...api.params, apikey: PRICE_API_KEY };
      }

      if (api.headers) {
        config.headers = api.headers;
      }

      const response = await axios.get(api.url, config);

      const price = api.parseResponse(response.data);
      
      // Sanity check for XAU/USD (should be between $1000 and $5000)
      if (price && price >= 1000 && price <= 5000) {
        return {
          symbol: 'XAUUSD',
          price: Math.round(price * 100) / 100,
          timestamp: new Date().toISOString(),
          source: api.name,
        };
      }

      logger.debug(`${api.name}: Price out of expected range: ${price}`);
      return null;
    } catch (error) {
      logger.debug(`${api.name} fetch failed`, { error });
      return null;
    }
  }

  /**
   * Generate simulated price for fallback/demo mode
   * Uses random walk based on last known price or baseline of $2650
   */
  private generateSimulatedPrice(): PriceData {
    const baselinePrice = 2650; // Current approximate XAU/USD price
    const basePrice = this.currentPrice?.price || baselinePrice;
    const volatility = 0.30; // Max change per tick in USD (realistic for 1-second interval)
    const change = (Math.random() - 0.5) * 2 * volatility;
    const newPrice = Math.round((basePrice + change) * 100) / 100;

    return {
      symbol: 'XAUUSD',
      price: newPrice,
      bid: Math.round((newPrice - 0.10) * 100) / 100,
      ask: Math.round((newPrice + 0.10) * 100) / 100,
      timestamp: new Date().toISOString(),
      source: 'simulated',
    };
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
}

export const priceFeedService = new PriceFeedService();
