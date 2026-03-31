import axios from 'axios';
import logger from '../logger.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * TradingView Price Scraper
 * 
 * Fetches XAU/USD price from TradingView using their widget data endpoint
 */
export class TradingViewScraper {
  private lastPrice: number | null = null;
  private lastUpdate: Date | null = null;
  
  /**
   * Fetch XAU/USD price from TradingView
   * Uses the public widget quote endpoint
   */
  async fetchPrice(): Promise<number | null> {
    try {
      // Method 1: Try TradingView's public quote API
      const price = await this.fetchFromQuoteApi();
      if (price && this.isValidPrice(price)) {
        this.lastPrice = price;
        this.lastUpdate = new Date();
        return price;
      }
      
      // Method 2: Try alternative endpoint
      const altPrice = await this.fetchFromAlternativeEndpoint();
      if (altPrice && this.isValidPrice(altPrice)) {
        this.lastPrice = altPrice;
        this.lastUpdate = new Date();
        return altPrice;
      }
      
      return null;
    } catch (error) {
      logger.debug('TradingView fetch failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
  
  /**
   * Fetch from TradingView's quote API
   */
  private async fetchFromQuoteApi(): Promise<number | null> {
    try {
      // TradingView's public quote endpoint for forex symbols
      const response = await axios.get(
        'https://symbol-search.tradingview.com/symbol_search.json',
        {
          params: {
            text: 'XAUUSD',
            type: 'forex',
          },
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 5000,
        }
      );
      
      // This endpoint returns symbol info, not live price
      // We need to use the widget data instead
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Alternative method: Use TradingView's odata endpoint
   */
  private async fetchFromAlternativeEndpoint(): Promise<number | null> {
    try {
      // Try the TV data endpoint that powers widgets
      const response = await axios.get(
        'https://data.tradingview.com/v1/ticker_data',
        {
          params: {
            exchange: 'OANDA',
            symbol: 'XAUUSD',
          },
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': '*/*',
            'Origin': 'https://www.tradingview.com',
            'Referer': 'https://www.tradingview.com/',
          },
          timeout: 5000,
        }
      );
      
      const data = response.data as {
        last?: number;
        last_time?: string;
        change?: number;
        change_percent?: number;
        volume?: number;
      };
      
      if (data.last && this.isValidPrice(data.last)) {
        return data.last;
      }
      
      return null;
    } catch (error) {
      logger.debug('TradingView alternative endpoint failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
  
  /**
   * Fetch from TradingView widget HTML (fallback)
   * Scrapes the price from the rendered widget page
   */
  async fetchFromWidget(): Promise<number | null> {
    try {
      // Fetch a page that embeds the TradingView widget
      const response = await axios.get(
        'https://www.tradingview.com/symbols/XAUUSD/',
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 8000,
          maxRedirects: 3,
        }
      );
      
      const html = response.data as string;
      
      // Try multiple patterns to extract price
      const patterns = [
        // Pattern for price in JSON data
        /"last_price"\s*:\s*"?([\d.]+)"?/i,
        // Pattern for price display
        /class="[^"]*price[^"]*"[^>]*>\s*\$?([\d,]+\.?\d*)/i,
        // Pattern for XAUUSD specific price
        /XAUUSD["\s>]+([\d,]+\.?\d*)/i,
        // Generic price pattern
        /last\s*["':]\s*([\d,]+\.?\d*)/i,
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const priceStr = match[1].replace(/,/g, '');
          const price = parseFloat(priceStr);
          if (this.isValidPrice(price)) {
            this.lastPrice = price;
            this.lastUpdate = new Date();
            return price;
          }
        }
      }
      
      // Try to find price in embedded JSON
      const jsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          // Look for price in structured data
          if (jsonData.price || jsonData.offers?.price) {
            const price = parseFloat(jsonData.price || jsonData.offers.price);
            if (this.isValidPrice(price)) {
              this.lastPrice = price;
              this.lastUpdate = new Date();
              return price;
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
      
      return null;
    } catch (error) {
      logger.debug('TradingView widget scrape failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
  
  /**
   * Get cached price if recent
   */
  getCachedPrice(maxAgeMs: number = 5000): number | null {
    if (!this.lastPrice || !this.lastUpdate) {
      return null;
    }
    
    const age = Date.now() - this.lastUpdate.getTime();
    if (age > maxAgeMs) {
      return null;
    }
    
    return this.lastPrice;
  }
  
  getLastPrice(): number | null {
    return this.lastPrice;
  }
  
  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }
  
  private isValidPrice(price: number): boolean {
    // XAU/USD should be between $1000 and $5000
    return price >= 1000 && price <= 5000;
  }
}

export const tradingViewScraper = new TradingViewScraper();
