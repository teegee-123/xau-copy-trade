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
export type MatchType = 'regex' | 'startswith' | 'endswith' | 'contains';

export type ExtractionTransform = 
  | 'uppercase' 
  | 'lowercase' 
  | 'parseFloat' 
  | 'parseRange' 
  | 'substring' 
  | 'split' 
  | 'after' 
  | 'before'
  | 'parseInt'
  | 'trim';

export interface ExtractionRule {
  group?: number;  // For regex capture groups
  transform: ExtractionTransform;
  marker?: string;  // For after/before/split operations
  startIndex?: number;  // For substring
  endIndex?: number;  // For substring
  splitIndex?: number;  // For split operation
  mapping?: Record<string, string>;
  description?: string;
  note?: string;
}

/**
 * Signal Template Configuration
 */
export interface SignalTemplate {
  description: string;
  // Regex mode (existing)
  pattern?: string;
  flags?: string;
  // Simple match mode (new)
  matchType?: MatchType;
  matchValue?: string;  // The literal text to match for startswith/endswith/contains
  caseSensitive?: boolean;  // Toggle for case sensitivity
  // Extraction
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
 * Polling interval constraints
 */
export const POLLING_INTERVAL_MIN_MS = 200;  // Minimum 200ms
export const POLLING_INTERVAL_MAX_MS = 120000;  // Maximum 120s

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
        pollingIntervalMs: parseInt(process.env.PRICE_FEED_POLLING_INTERVAL_MS || '1000', 10),
      },
    };
  }

  /**
   * Get default entry signal template
   */
  private getDefaultEntryTemplate(): SignalTemplate {
    return {
      description: 'Entry signal: "Gold buy 4586"',
      matchType: 'regex',
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
          message: 'Gold buy 4586',
          extracted: { symbol: 'XAUUSD', action: 'BUY', maxEntryPrice: 4586 },
        },
        {
          message: 'gold sell 4500',
          extracted: { symbol: 'XAUUSD', action: 'SELL', maxEntryPrice: 4500 },
        },
      ],
    };
  }

  /**
   * Get default SL/TP signal template
   */
  private getDefaultSltpTemplate(): SignalTemplate {
    return {
      description: 'SL/TP update: Multi-line format with SL and TP on separate lines (supports emojis)',
      matchType: 'regex',
      // Improved pattern to handle:
      // - Emojis after SL/TP (SL🔴4704, TP✅4718)
      // - Various formats: "SL:", "SL", "SL🔴", "TP:", "TP", "TP✅"
      // - Entry price with @ symbol: "Buy @ 4712 - 4708"
      pattern: '(?:GOLD|XAU(?:USD)?)\\s+(?:BUY|SELL)[\\s\\S]*?(?:SL|🔴)[\\s\\n:]*([\\d.]+)[\\s\\S]*?(?:TP|✅)[\\s\\n:]*([\\d.]+)',
      flags: 'i',
      extractionRules: {
        stopLoss: {
          group: 1,
          transform: 'parseFloat',
          description: 'Extract SL value after "SL" or 🔴 emoji',
        },
        takeProfit: {
          group: 2,
          transform: 'parseFloat',
          description: 'Extract first TP value (lowest for BUY orders)',
          note: 'When multiple TPs exist, the first one is typically the lowest/closest',
        },
      },
      examples: [
        {
          message: 'GOLD BUY NOW\n\nBuy @ 4712 - 4708\n\nSL🔴4704\nTP✅4718\nTP✅4722\n\nCare Money Management 💠',
          extracted: {
            stopLoss: 4704,
            takeProfit: 4718,
          },
        },
        {
          message: 'GOLD BUY NOW\n\nBuy @ 4685 - 4681\n\nSL\n4676\nTP\n4691\nTP\n4695\n\nCare Money Management',
          extracted: {
            stopLoss: 4676,
            takeProfit: 4691,
          },
        },
        {
          message: 'XAU SELL NOW\n\nEntry @ 4550\n\nSL\n4560\nTP\n4540\n\nRisk Management',
          extracted: {
            stopLoss: 4560,
            takeProfit: 4540,
          },
        },
        {
          message: 'GOLD BUY NOW\n\nSL: 4676\nTP: 4691\n\nMoney Management',
          extracted: {
            stopLoss: 4676,
            takeProfit: 4691,
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
   * Validate a pattern based on match type
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
   * Validate a template
   */
  validateTemplate(template: SignalTemplate): { valid: boolean; error?: string } {
    const matchType = template.matchType || 'regex';

    if (matchType === 'regex') {
      if (!template.pattern) {
        return { valid: false, error: 'Regex pattern is required' };
      }
      return this.validatePattern(template.pattern, template.flags || 'i');
    } else {
      // Simple match types
      if (!template.matchValue) {
        return { valid: false, error: 'Match value is required for ' + matchType };
      }
      if (template.matchValue.length === 0) {
        return { valid: false, error: 'Match value cannot be empty' };
      }
    }

    return { valid: true };
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

      if (!template) {
        return {
          matched: false,
          extracted: null,
          error: 'Template not found',
        };
      }

      // Validate template
      const validation = this.validateTemplate(template);
      if (!validation.valid) {
        return {
          matched: false,
          extracted: null,
          error: validation.error,
        };
      }

      const matchType = template.matchType || 'regex';
      let match: RegExpExecArray | null = null;
      let matched = false;

      if (matchType === 'regex') {
        if (!template.pattern) {
          return {
            matched: false,
            extracted: null,
            error: 'Pattern is required for regex matching',
          };
        }
        const regex = new RegExp(template.pattern, template.flags || 'i');
        match = regex.exec(message);
        matched = match !== null;
      } else {
        // Simple string matching
        if (!template.matchValue) {
          return {
            matched: false,
            extracted: null,
            error: 'Match value is required for ' + matchType + ' matching',
          };
        }
        const searchValue = template.caseSensitive
          ? template.matchValue
          : template.matchValue.toLowerCase();
        const searchText = template.caseSensitive ? message : message.toLowerCase();

        switch (matchType) {
          case 'startswith':
            matched = searchText.startsWith(searchValue);
            break;
          case 'endswith':
            matched = searchText.endsWith(searchValue);
            break;
          case 'contains':
            matched = searchText.includes(searchValue);
            break;
        }
        // For simple matching, create a pseudo-match with full text as group 0
        if (matched) {
          match = [message] as RegExpExecArray;
        }
      }

      if (!matched) {
        return {
          matched: false,
          extracted: null,
        };
      }

      // Extract values using extraction rules
      const extracted: Record<string, unknown> = {};

      for (const [fieldName, rule] of Object.entries(template.extractionRules || {})) {
        let value: string | undefined;

        // Get value from regex group or full match
        if (rule.group !== undefined && match && match[rule.group]) {
          value = match[rule.group];
        } else if (match && match[0]) {
          // Use full match if no group specified
          value = match[0];
        }

        if (value === undefined) continue;

        let transformedValue: unknown = value;

        // Apply transform
        switch (rule.transform) {
          case 'uppercase':
            transformedValue = value.toUpperCase();
            break;
          case 'lowercase':
            transformedValue = value.toLowerCase();
            break;
          case 'parseFloat':
            transformedValue = parseFloat(value);
            break;
          case 'parseInt':
            transformedValue = parseInt(value, 10);
            break;
          case 'parseRange':
            // Handle range like "4553-4556"
            const rangeMatch = value.match(/([\d.]+)\s*-\s*([\d.]+)/);
            if (rangeMatch) {
              transformedValue = {
                min: parseFloat(rangeMatch[1]),
                max: parseFloat(rangeMatch[2]),
              };
            } else {
              transformedValue = parseFloat(value);
            }
            break;
          case 'substring':
            if (rule.startIndex !== undefined && rule.endIndex !== undefined) {
              transformedValue = value.substring(rule.startIndex, rule.endIndex);
            }
            break;
          case 'split':
            if (rule.marker && rule.splitIndex !== undefined) {
              const parts = value.split(rule.marker);
              transformedValue = parts[rule.splitIndex];
            }
            break;
          case 'after':
            if (rule.marker) {
              const index = value.indexOf(rule.marker);
              if (index !== -1) {
                transformedValue = value.substring(index + rule.marker.length);
              }
            }
            break;
          case 'before':
            if (rule.marker) {
              const index = value.indexOf(rule.marker);
              if (index !== -1) {
                transformedValue = value.substring(0, index);
              }
            }
            break;
          case 'trim':
            transformedValue = value.trim();
            break;
        }

        // Apply mapping if exists
        if (rule.mapping && typeof transformedValue === 'string' && transformedValue in rule.mapping) {
          transformedValue = rule.mapping[transformedValue];
        }

        extracted[fieldName] = transformedValue;
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

  /**
   * Validate polling interval (must be between 200ms and 120s)
   */
  validatePollingInterval(intervalMs: number): { valid: boolean; error?: string } {
    if (isNaN(intervalMs) || intervalMs < POLLING_INTERVAL_MIN_MS || intervalMs > POLLING_INTERVAL_MAX_MS) {
      return {
        valid: false,
        error: `Polling interval must be between ${POLLING_INTERVAL_MIN_MS}ms and ${POLLING_INTERVAL_MAX_MS}ms (${POLLING_INTERVAL_MAX_MS / 1000}s)`,
      };
    }
    return { valid: true };
  }
}

export const configService = new ConfigService();
