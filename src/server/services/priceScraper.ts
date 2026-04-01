import axios from 'axios';
import WebSocket from 'ws';
import logger from '../logger.js';

/**
 * Robust Price Scraper Service
 * 
 * Multiple fallback sources for XAU/USD (Gold) prices:
 * 1. TradingView WebSocket (real-time, free, no key)
 * 2. CommodityPriceAPI (free tier, instant key)
 * 3. API-Ninjas (5000 free requests/month)
 * 4. Web scraping from financial websites
 * 5. Simulated prices as last resort
 */

const REQUEST_TIMEOUT = 8000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const commonHeaders = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
};

/**
 * TradingView WebSocket connection manager
 */
class TradingViewWebSocket {
  private ws: WebSocket | null = null;
  private lastPrice: number | null = null;
  private lastUpdate: Date | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pendingResolves: ((price: number | null) => void)[] = [];
  private connectionPromise: Promise<boolean> | null = null;

  async connect(): Promise<boolean> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return true;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve) => {
      this.connectInternal(resolve);
    });

    return this.connectionPromise;
  }

  private connectInternal(resolve: (connected: boolean) => void): void {
    try {
      // TradingView WebSocket endpoint
      this.ws = new WebSocket('wss://data.tradingview.com/socket.io/?EIO=3&transport=websocket');

      this.ws.on('open', () => {
        logger.debug('TradingView WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Send session initialization
        this.ws?.send('m{"name":"session_init","args":[{"session":"GUI_SESSION","auth":{}}]}');
        
        // Subscribe to XAUUSD
        this.subscribeToSymbol();
        
        resolve(true);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        logger.debug('TradingView WebSocket error:', error.message);
        this.isConnected = false;
        resolve(false);
        this.scheduleReconnect();
      });

      this.ws.on('close', () => {
        logger.debug('TradingView WebSocket closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          logger.debug('TradingView WebSocket connection timeout');
          resolve(false);
          this.ws?.close();
        }
      }, REQUEST_TIMEOUT);

    } catch (error) {
      logger.debug('TradingView WebSocket connection failed:', error instanceof Error ? error.message : 'Unknown error');
      resolve(false);
    }
  }

  private subscribeToSymbol(): void {
    // Subscribe to forex symbol
    const subscribeMsg = 'm{"name":"resolve_symbol","args":[{"symbol":"FOREXCOM:XAUUSD","guid":"XAUUSD_GUID"}]}';
    this.ws?.send(subscribeMsg);

    // Request quote
    const quoteMsg = 'm{"name":"quote_create","args":[{"fields":["price","last","change","change_percent"],"symbols":["FOREXCOM:XAUUSD"]}]}'
    this.ws?.send(quoteMsg);
  }

  private handleMessage(message: string): void {
    try {
      // Parse TradingView message format
      if (message.startsWith('m')) {
        const jsonStr = message.substring(1);
        const data = JSON.parse(jsonStr);
        
        if (data.name === 'quote' && data.args?.[0]?.price) {
          const price = parseFloat(data.args[0].price);
          if (this.isValidPrice(price)) {
            this.lastPrice = price;
            this.lastUpdate = new Date();
            logger.debug(`TradingView price update: ${price}`);
            
            // Resolve any pending requests
            while (this.pendingResolves.length > 0) {
              const resolve = this.pendingResolves.shift();
              resolve?.(price);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.debug('TradingView WebSocket max reconnect attempts reached');
      this.connectionPromise = null;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.debug(`TradingView WebSocket reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectionPromise = null;
      this.connectInternal(() => {});
    }, delay);
  }

  async getPrice(timeout: number = 5000): Promise<number | null> {
    if (this.lastPrice && this.lastUpdate) {
      const age = Date.now() - this.lastUpdate.getTime();
      if (age < 10000) { // 10 seconds cache
        return this.lastPrice;
      }
    }

    // Try to connect and get price
    const connected = await this.connect();
    if (!connected) {
      return this.lastPrice; // Return cached if available
    }

    // Wait for price update
    return new Promise((resolve) => {
      if (this.lastPrice) {
        resolve(this.lastPrice);
        return;
      }

      this.pendingResolves.push(resolve);

      setTimeout(() => {
        const idx = this.pendingResolves.indexOf(resolve);
        if (idx > -1) {
          this.pendingResolves.splice(idx, 1);
        }
        resolve(this.lastPrice);
      }, timeout);
    });
  }

  private isValidPrice(price: number): boolean {
    return price >= 1000 && price <= 5000;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }
}

/**
 * Source type definitions
 */
interface WebSocketSource {
  name: string;
  type: 'websocket';
  fetch: () => Promise<number | null>;
}

interface ApiSource {
  name: string;
  type: 'api';
  url: string;
  params?: Record<string, string>;
  headers: Record<string, string>;
  parseResponse: (data: unknown) => number | null;
}

interface ScrapeSource {
  name: string;
  type: 'scrape';
  url: string;
  headers: Record<string, string>;
  parseResponse: (html: string) => number | null;
}

type PriceSource = WebSocketSource | ApiSource | ScrapeSource;

/**
 * Source definitions with multiple fallback options
 * Priority: TradingView HTML scrape first, then WebSocket, then API fallbacks
 */
const PRICE_SOURCES: PriceSource[] = [
  {
    name: 'tradingview-scrape',
    type: 'scrape',
    url: 'https://www.tradingview.com/symbols/XAUUSD/',
    headers: {
      ...commonHeaders,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
    },
    parseResponse: (html: string) => {
      // Try multiple patterns to extract price from TradingView HTML
      const patterns = [
        // JSON data patterns - most reliable
        /"last_price"\s*:\s*"?([\d.]+)"?/i,
        /"close"\s*:\s*"?([\d.]+)"?/i,
        /"last"\s*:\s*"?([\d.]+)"?/i,
        /"price"\s*:\s*"?([\d.]+)"?/i,
        /"current_price"\s*:\s*"?([\d.]+)"?/i,
        // Data attribute patterns
        /data-price=["']([\d.]+)["']/i,
        /data-last=["']([\d.]+)["']/i,
        /data-current=["']([\d.]+)["']/i,
        // Text patterns with context
        /XAUUSD["\s>]+([\d,]+\.?\d*)/i,
        /Gold\s*[\(\/]XAUUSD[\)]?.*?\$?\s*([\d,]+\.?\d*)/i,
        /XAU\/USD.*?\$?\s*([\d,]+\.?\d*)/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const priceStr = match[1].replace(/,/g, '');
          const price = parseFloat(priceStr);
          if (price >= 1000 && price <= 5000) {
            logger.debug(`TradingView scrape: found price ${price}`);
            return price;
          }
        }
      }

      // Try to find price in embedded JSON-LD
      const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.price) {
            const price = parseFloat(jsonData.price);
            if (price >= 1000 && price <= 5000) {
              logger.debug(`TradingView JSON-LD: found price ${price}`);
              return price;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Try to find price in embedded JavaScript variables
      const jsVarMatch = html.match(/window\.__context__\s*=\s*({[\s\S]*?});/i);
      if (jsVarMatch) {
        try {
          const contextData = JSON.parse(jsVarMatch[1]);
          if (contextData?.quote?.price) {
            const price = parseFloat(contextData.quote.price);
            if (price >= 1000 && price <= 5000) {
              logger.debug(`TradingView JS context: found price ${price}`);
              return price;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      logger.debug('TradingView scrape: no price found in HTML');
      return null;
    }
  },
  {
    name: 'tradingview-ws',
    type: 'websocket',
    fetch: async () => {
      const price = await tradingViewWs.getPrice();
      return price;
    }
  },
  {
    name: 'commoditypriceapi',
    type: 'api',
    url: 'https://api.commoditypriceapi.com/v2/rates/latest',
    params: { base: 'USD', symbols: 'XAU', api_key: process.env.COMMODITY_PRICE_API_KEY || 'demo' },
    headers: { ...commonHeaders },
    parseResponse: (data: unknown) => {
      const response = data as { success?: boolean; rates?: { XAU?: number }; error?: string };
      if (!response.success || !response.rates?.XAU) return null;
      // Returns XAU per USD, invert to get USD per XAU
      const price = 1 / response.rates.XAU;
      return price;
    }
  },
  {
    name: 'api-ninjas',
    type: 'api',
    url: 'https://api.api-ninjas.com/v1/goldprice',
    headers: { 
      ...commonHeaders,
      'X-Api-Key': process.env.API_NINJAS_KEY || 'demo'
    },
    parseResponse: (data: unknown) => {
      const response = data as { price_per_ounce?: number; spot_price?: number };
      return response.price_per_ounce || response.spot_price || null;
    }
  },
  {
    name: 'twelvedata',
    type: 'api',
    url: 'https://api.twelvedata.com/price',
    params: { symbol: 'XAU/USD', apikey: 'demo' },
    headers: { ...commonHeaders },
    parseResponse: (data: unknown) => {
      const response = data as { price?: string; status?: string; code?: number };
      if (response.status === 'error' || response.code === 401 || !response.price) return null;
      return parseFloat(response.price);
    }
  },
  {
    name: 'binance-paxg',
    type: 'api',
    // PAX Gold (PAXG) is a tokenized gold - price tracks XAU closely
    url: 'https://api.binance.com/api/v3/ticker/price',
    params: { symbol: 'PAXGUSDT' },
    headers: { ...commonHeaders },
    parseResponse: (data: unknown) => {
      const response = data as { price?: string; code?: number; msg?: string };
      if (response.code || !response.price) return null;
      return parseFloat(response.price);
    }
  },
  {
    name: 'coingecko-paxg',
    type: 'api',
    url: 'https://api.coingecko.com/api/v3/simple/price',
    params: { ids: 'pax-gold', vs_currencies: 'usd' },
    headers: { ...commonHeaders },
    parseResponse: (data: unknown) => {
      const response = data as { 'pax-gold'?: { usd?: number } };
      if (!response['pax-gold']?.usd) return null;
      return response['pax-gold'].usd;
    }
  },
  {
    name: 'kitco',
    type: 'scrape',
    url: 'https://www.kitco.com/charts/live/gold.html',
    headers: { ...commonHeaders },
    parseResponse: (html: string) => {
      const patterns = [
        /["']?price["']?\s*[:=]\s*["']?([\d,]+\.?\d*)["']?/i,
        /Gold.*?\$?([\d,]+\.?\d*)/i,
        /XAU.*?\$?([\d,]+\.?\d*)/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const priceStr = match[1].replace(/,/g, '');
          const price = parseFloat(priceStr);
          if (price >= 1000 && price <= 5000) {
            return price;
          }
        }
      }
      return null;
    }
  },
];

export interface ScrapedPriceData {
  price: number;
  source: string;
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
}

// Singleton WebSocket instance
const tradingViewWs = new TradingViewWebSocket();

/**
 * Price Scraper Service - fetches from multiple sources with fallbacks
 */
export class PriceScraperService {
  private lastKnownPrice: number | null = null;
  private lastSuccessfulSource: string | null = null;
  private consecutiveFailures = 0;
  private priceHistory: number[] = [];

  /**
   * Try all sources in priority order until one succeeds
   */
  async fetchPrice(): Promise<ScrapedPriceData | null> {
    for (const source of PRICE_SOURCES) {
      try {
        const result = await this.fetchFromSource(source);
        if (result && this.isValidPrice(result.price)) {
          this.lastKnownPrice = result.price;
          this.lastSuccessfulSource = result.source;
          this.consecutiveFailures = 0;
          
          // Track price history for simulation
          this.priceHistory.push(result.price);
          if (this.priceHistory.length > 100) {
            this.priceHistory.shift();
          }
          
          return result;
        }
      } catch (error) {
        logger.debug(`${source.name} fetch failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // All sources failed
    this.consecutiveFailures++;
    return null;
  }

  private async fetchFromSource(source: PriceSource): Promise<ScrapedPriceData | null> {
    try {
      let price: number | null = null;

      if (source.type === 'websocket') {
        price = await source.fetch();
      } else if (source.type === 'api') {
        const url = new URL(source.url);
        if (source.params) {
          Object.entries(source.params).forEach(([key, value]) => {
            url.searchParams.set(key, String(value));
          });
        }
        
        const response = await axios.get(url.toString(), {
          headers: source.headers,
          timeout: REQUEST_TIMEOUT,
          responseType: 'json',
          validateStatus: (status) => status >= 200 && status < 400,
        });

        price = source.parseResponse(response.data);
      } else if (source.type === 'scrape') {
        const response = await axios.get(source.url, {
          headers: source.headers,
          timeout: REQUEST_TIMEOUT,
          responseType: 'text',
          validateStatus: (status) => status >= 200 && status < 400,
          maxRedirects: 3,
        });

        price = source.parseResponse(response.data as string);
      }

      if (price && this.isValidPrice(price)) {
        return {
          price: Math.round(price * 100) / 100,
          source: source.name,
          timestamp: new Date().toISOString(),
          confidence: this.getSourceConfidence(source.name),
        };
      }

      return null;
    } catch (error) {
      logger.debug(`${source.name} error:`, error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  private isValidPrice(price: number): boolean {
    // XAU/USD should be between $1000 and $5000
    return price >= 1000 && price <= 5000;
  }

  private getSourceConfidence(sourceName: string): 'high' | 'medium' | 'low' {
    const highConfidenceSources = ['tradingview-ws', 'commoditypriceapi', 'api-ninjas'];
    const mediumConfidenceSources = ['twelvedata', 'binance-paxg', 'coingecko-paxg'];

    if (highConfidenceSources.includes(sourceName)) return 'high';
    if (mediumConfidenceSources.includes(sourceName)) return 'medium';
    return 'low';
  }

  /**
   * Generate simulated price based on price history with realistic movement
   */
  generateSimulatedPrice(): ScrapedPriceData {
    const baselinePrice = 2650; // Approximate current XAU/USD
    
    // Use recent price history if available
    let basePrice = baselinePrice;
    if (this.priceHistory.length > 0) {
      basePrice = this.priceHistory[this.priceHistory.length - 1];
    } else if (this.lastKnownPrice) {
      basePrice = this.lastKnownPrice;
    }

    // Realistic volatility for 1-second interval: ~$0.10-0.30
    const maxChange = 0.30;
    const change = (Math.random() - 0.5) * 2 * maxChange;
    const newPrice = Math.round((basePrice + change) * 100) / 100;

    return {
      price: newPrice,
      source: 'simulated',
      timestamp: new Date().toISOString(),
      confidence: 'low',
    };
  }

  getLastKnownPrice(): number | null {
    return this.lastKnownPrice;
  }

  getLastSuccessfulSource(): string | null {
    return this.lastSuccessfulSource;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    tradingViewWs.disconnect();
  }
}

export const priceScraperService = new PriceScraperService();
