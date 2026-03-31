import { EventEmitter } from 'events';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import logger from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Try multiple possible locations for config file
const configPaths = [
  path.join(__dirname, '../../config/trade-templates.json'),
  path.join(__dirname, '../../../src/config/trade-templates.json'),
  path.join(process.cwd(), 'src/config/trade-templates.json'),
];

/**
 * Extraction Rule for template parsing
 */
export interface ExtractionRule {
  group: number;
  transform: string;
  mapping?: Record<string, string>;
  description?: string;
  note?: string;
}

/**
 * Signal Template Configuration
 */
export interface SignalTemplate {
  description: string;
  pattern: string;
  flags: string;
  extractionRules: Record<string, ExtractionRule>;
  examples: Array<{
    message: string;
    extracted: Record<string, unknown>;
  }>;
}

/**
 * Channel Configuration
 */
export interface ChannelConfig {
  channelId: string;
  channelName: string;
}

/**
 * Trading Configuration
 */
export interface TradingConfig {
  defaultLotSize: number;
  slTpTimeoutMinutes: number;
}

/**
 * Price Feed Configuration
 */
export interface PriceFeedConfig {
  pollingIntervalMs: number;
}

/**
 * Complete Configuration
 */
export interface AppConfig {
  channel: ChannelConfig;
  entrySignalTemplate: SignalTemplate;
  sltpSignalTemplate: SignalTemplate;
  trading: TradingConfig;
  priceFeed: PriceFeedConfig;
}

/**
 * Template Test Result
 */
export interface TemplateTestResult {
  matched: boolean;
  extracted: Record<string, unknown> | null;
  error?: string;
}

/**
 * Runtime Configuration Service
 *
 * Manages application configuration at runtime:
 * - Loads initial config from trade-templates.json and .env
 * - Allows runtime updates (not persisted to disk)
 * - Emits events when config changes
 * - Provides template testing functionality
 */
export class ConfigService extends EventEmitter {
  private config: AppConfig;
  private initialized = false;

  constructor() {
    super();
    this.config = this.loadDefaultConfig();
  }

  /**
   * Load default configuration from files and environment
   */
  private loadDefaultConfig(): AppConfig {
    // Load trade templates from JSON file
    let tradeTemplates: { 
      channelConfig?: ChannelConfig;
      entrySignalTemplate?: SignalTemplate;
      sltpSignalTemplate?: SignalTemplate;
    } = { 
      entrySignalTemplate: this.getDefaultEntryTemplate(),
      sltpSignalTemplate: this.getDefaultSltpTemplate()
    };

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          tradeTemplates = JSON.parse(readFileSync(configPath, 'utf-8'));
          logger.info('Loaded trade templates from', { path: configPath });
          break;
        } catch (error) {
          logger.warn('Failed to parse trade templates', { path: configPath, error });
        }
      }
    }

    // Build config from templates and environment
    return {
      channel: tradeTemplates.channelConfig || {
        channelId: process.env.TELEGRAM_CHANNEL_ID || '',
        channelName: 'XAU Signals Pro',
      },
      entrySignalTemplate: tradeTemplates.entrySignalTemplate || this.getDefaultEntryTemplate(),
      sltpSignalTemplate: tradeTemplates.sltpSignalTemplate || this.getDefaultSltpTemplate(),
      trading: {
        defaultLotSize: parseFloat(process.env.DEFAULT_LOT_SIZE || '0.1'),
        slTpTimeoutMinutes: parseInt(process.env.SL_TP_TIMEOUT_MINUTES || '5', 10),
      },
      priceFeed: {
        pollingIntervalMs: 1000, // Default 1 second
      },
    };
  }

  /**
   * Get default entry signal template
   */
  private getDefaultEntryTemplate(): SignalTemplate {
    return {
      description: 'Pattern to detect initial trade signal (e.g., "gold buy 4556")',
      pattern: '^(gold|xau(?:usd)?)\\s+(buy|sell)\\s+([\\d.]+)$',
      flags: 'i',
      extractionRules: {
        symbol: {
          group: 1,
          transform: 'uppercase',
          mapping: {
            GOLD: 'XAUUSD',
            XAU: 'XAUUSD',
            XAUUSD: 'XAUUSD',
          },
        },
        action: {
          group: 2,
          transform: 'uppercase',
        },
        maxEntryPrice: {
          group: 3,
          transform: 'parseFloat',
        },
      },
      examples: [
        {
          message: 'gold buy 4556',
          extracted: { symbol: 'XAUUSD', action: 'BUY', maxEntryPrice: 4556 },
        },
        {
          message: 'XAUUSD SELL 4600',
          extracted: { symbol: 'XAUUSD', action: 'SELL', maxEntryPrice: 4600 },
        },
      ],
    };
  }

  /**
   * Get default SL/TP signal template
   */
  private getDefaultSltpTemplate(): SignalTemplate {
    return {
      description: 'Pattern to detect updated signal with SL/TP (edited message)',
      pattern: '(gold|xau(?:usd)?)\\s+(buy|sell)[\\s\\S]*?(?:entry|buy at)[\\s:]+([\\d.\\-]+)[\\s\\S]*?(?:sl|stop loss)[\\s:]+([\\d.]+)[\\s\\S]*?(?:tp|take profit)[\\s:]+([\\d.]+)',
      flags: 'i',
      extractionRules: {
        symbol: {
          group: 1,
          transform: 'uppercase',
          mapping: {
            GOLD: 'XAUUSD',
            XAU: 'XAUUSD',
            XAUUSD: 'XAUUSD',
          },
        },
        action: {
          group: 2,
          transform: 'uppercase',
        },
        entryPriceRange: {
          group: 3,
          transform: 'parseRange',
          description: "Parse '4553-4556' into { min: 4553, max: 4556 }",
        },
        stopLoss: {
          group: 4,
          transform: 'parseFloat',
        },
        takeProfit: {
          group: 5,
          transform: 'parseFloat',
          note: 'If multiple TP values exist, use the first (lowest for BUY, highest for SELL)',
        },
      },
      examples: [
        {
          message: 'GOLD BUY NOW\nEntry: 4553-4556\nSL: 4546\nTP: 4559\nTP: 4565',
          extracted: {
            symbol: 'XAUUSD',
            action: 'BUY',
            entryPriceRange: { min: 4553, max: 4556 },
            stopLoss: 4546,
            takeProfit: 4559,
          },
        },
      ],
    };
  }

  /**
   * Initialize the config service
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('Config service already initialized');
      return;
    }

    logger.info('Config service initialized', {
      channelId: this.config.channel.channelId,
      lotSize: this.config.trading.defaultLotSize,
      pollingInterval: this.config.priceFeed.pollingIntervalMs,
    });
    this.initialized = true;
  }

  /**
   * Get complete configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get specific section of configuration
   */
  getConfigSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return { ...this.config[section] };
  }

  /**
   * Update configuration (partial updates supported)
   */
  updateConfig(section: keyof AppConfig, data: Partial<AppConfig[keyof AppConfig]>): void {
    if (!this.initialized) {
      logger.warn('Config service not initialized');
      return;
    }

    const previousConfig = { ...this.config };

    // Merge the update - use Object.assign for type safety
    Object.assign(this.config[section], data);

    logger.info('Configuration updated', {
      section,
      changes: Object.keys(data),
    });

    // Emit event for this section
    this.emit('configChange', {
      section,
      config: this.config[section],
      previous: previousConfig[section],
    });

    // Emit specific section events
    this.emit(`${section}Change`, this.config[section]);
  }

  /**
   * Validate a regex pattern
   */
  validatePattern(pattern: string, flags: string): { valid: boolean; error?: string } {
    try {
      new RegExp(pattern, flags);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid regex pattern',
      };
    }
  }

  /**
   * Test a template against a message
   */
  testTemplate(
    templateType: 'entry' | 'sltp',
    message: string,
    customTemplate?: SignalTemplate
  ): TemplateTestResult {
    try {
      const template = customTemplate || this.config[`${templateType}SignalTemplate`];

      if (!template || !template.pattern) {
        return {
          matched: false,
          extracted: null,
          error: 'Template not found or invalid',
        };
      }

      // Validate pattern
      const validation = this.validatePattern(template.pattern, template.flags);
      if (!validation.valid) {
        return {
          matched: false,
          extracted: null,
          error: validation.error,
        };
      }

      // Create regex and test
      const regex = new RegExp(template.pattern, template.flags);
      const match = message.match(regex);

      if (!match) {
        return {
          matched: false,
          extracted: null,
        };
      }

      // Extract values using extraction rules
      const extracted: Record<string, unknown> = {};

      for (const [fieldName, rule] of Object.entries(template.extractionRules)) {
        const groupValue = match[rule.group];

        if (groupValue === undefined) {
          continue;
        }

        let value: unknown = groupValue;

        // Apply transform
        switch (rule.transform) {
          case 'uppercase':
            value = groupValue.toUpperCase();
            break;
          case 'lowercase':
            value = groupValue.toLowerCase();
            break;
          case 'parseFloat':
            value = parseFloat(groupValue);
            break;
          case 'parseInt':
            value = parseInt(groupValue, 10);
            break;
          case 'parseRange':
            // Handle range like "4553-4556"
            const rangeMatch = groupValue.match(/([\d.]+)\s*-\s*([\d.]+)/);
            if (rangeMatch) {
              value = {
                min: parseFloat(rangeMatch[1]),
                max: parseFloat(rangeMatch[2]),
              };
            } else {
              value = parseFloat(groupValue);
            }
            break;
          case 'trim':
            value = groupValue.trim();
            break;
        }

        // Apply mapping if exists
        if (rule.mapping && typeof value === 'string' && value in rule.mapping) {
          value = rule.mapping[value];
        }

        extracted[fieldName] = value;
      }

      return {
        matched: true,
        extracted,
      };
    } catch (error) {
      return {
        matched: false,
        extracted: null,
        error: error instanceof Error ? error.message : 'Unknown error during template test',
      };
    }
  }

  /**
   * Get templates for signal parsing (used by Telegram service)
   */
  getTemplates(): { entrySignalTemplate: SignalTemplate; sltpSignalTemplate: SignalTemplate } {
    return {
      entrySignalTemplate: this.config.entrySignalTemplate,
      sltpSignalTemplate: this.config.sltpSignalTemplate,
    };
  }

  /**
   * Get channel config (used by Telegram service)
   */
  getChannelConfig(): ChannelConfig {
    return { ...this.config.channel };
  }

  /**
   * Get trading config (used by Trade Manager)
   */
  getTradingConfig(): TradingConfig {
    return { ...this.config.trading };
  }

  /**
   * Get price feed config (used by Price Feed service)
   */
  getPriceFeedConfig(): PriceFeedConfig {
    return { ...this.config.priceFeed };
  }
}

export const configService = new ConfigService();
