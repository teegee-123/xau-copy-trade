import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import type { NewMessageEvent } from 'telegram/events/NewMessage';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Api } = require('telegram');
import logger from '../logger.js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../../.env');
const envResult = dotenv.config({ path: envPath });
logger.info('=== TELEGRAM.TS: dotenv loaded:', { 
  parsed: envResult.parsed ? 'YES' : 'NO', 
  apiId: process.env.TELEGRAM_API_ID ? 'SET' : 'EMPTY',
  apiHash: process.env.TELEGRAM_API_HASH ? 'SET' : 'EMPTY',
  phone: process.env.TELEGRAM_PHONE ? 'SET' : 'EMPTY'
});
// Try multiple possible locations for config file
const configPaths = [
  join(__dirname, '../../config/trade-templates.json'),
  join(__dirname, '../../../src/config/trade-templates.json'),
  join(process.cwd(), 'src/config/trade-templates.json'),
];

let tradeTemplates: { entrySignalTemplate: Record<string, unknown>; sltpSignalTemplate: Record<string, unknown> } | null = null;
for (const configPath of configPaths) {
  if (existsSync(configPath)) {
    tradeTemplates = JSON.parse(readFileSync(configPath, 'utf-8'));
    break;
  }
}

if (!tradeTemplates) {
  logger.error('Could not find trade-templates.json config file');
  tradeTemplates = { entrySignalTemplate: {}, sltpSignalTemplate: {} };
}

const TELEGRAM_API_ID = process.env.TELEGRAM_API_ID || '';
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '';
const TELEGRAM_PHONE = process.env.TELEGRAM_PHONE || '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';
const SESSION_FILE_PATH = process.env.SESSION_FILE_PATH || './data/session.json';

export interface ParsedSignal {
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice?: number;
  maxEntryPrice?: number;
  entryPriceRange?: { min: number; max: number };
  stopLoss?: number;
  takeProfit?: number;
  rawMessage: string;
  messageId: number;
  isEdit: boolean;
}

export interface TelegramStatus {
  connected: boolean;
  authenticated: boolean;
  phoneNumber?: string;
  channelId?: string;
  error?: string;
}

export class TelegramService extends EventEmitter {
  private client: TelegramClient | null = null;
  private status: TelegramStatus = {
    connected: false,
    authenticated: false,
  };
  private isConnecting = false;
  private pendingCode: string = '';
  private stringSession: StringSession | null = null;
  private phoneCodeHash: string = '';

  constructor() {
    super();
  }

  getStatus(): TelegramStatus {
    return { ...this.status };
  }

  async initialize(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const sessionData = this.loadSession();
      this.stringSession = new StringSession(sessionData);

      this.client = new TelegramClient(
        this.stringSession,
        parseInt(TELEGRAM_API_ID) || 0,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 5,
          useWSS: true,
        }
      );

      await this.client.start({
        phoneNumber: async () => TELEGRAM_PHONE,
        phoneCode: async () => {
          logger.info('Waiting for verification code from user...');
          // Wait for code via API
          while (!this.pendingCode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          return this.pendingCode;
        },
        onError: (err) => {
          logger.error('Telegram connection error', { error: err });
          this.status.connected = false;
          this.status.error = err.message;
          this.emit('statusChange', this.status);
        },
      });

      this.status.connected = true;
      this.status.authenticated = true;
      this.status.phoneNumber = TELEGRAM_PHONE;
      this.status.channelId = TELEGRAM_CHANNEL_ID;

      if (this.stringSession) {
        const savedSession = this.stringSession.save();
        this.saveSession(savedSession);
      }
      logger.info('Telegram client initialized successfully');
      this.emit('statusChange', this.status);

      // Start listening for messages
      this.listenForMessages();
    } catch (error) {
      logger.error('Failed to initialize Telegram client', { error });
      this.status.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('statusChange', this.status);
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Initialize auth flow - request code to be sent
   */
  async requestAuthCode(phone: string): Promise<{ success: boolean; message: string }> {
    // Log current values for debugging
    logger.info('requestAuthCode called', {
      TELEGRAM_API_ID: TELEGRAM_API_ID ? '***' + TELEGRAM_API_ID.slice(-4) : 'EMPTY',
      TELEGRAM_API_HASH: TELEGRAM_API_HASH ? '***' + TELEGRAM_API_HASH.slice(-4) : 'EMPTY',
      phone
    });
    
    // Validate API credentials
    if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH) {
      logger.error('Missing Telegram API credentials');
      return {
        success: false,
        message: 'TELEGRAM_API_ID or TELEGRAM_API_HASH not configured',
      };
    }

    try {
      // Create and store string session for later use in verifyCode
      this.stringSession = new StringSession('');
      const apiIdNum = parseInt(TELEGRAM_API_ID) || 0;
      logger.info('Creating TelegramClient', { apiIdNum, apiHashLength: TELEGRAM_API_HASH.length });
      
      this.client = new TelegramClient(
        this.stringSession,
        apiIdNum,
        TELEGRAM_API_HASH,
        {
          connectionRetries: 3,
          useWSS: true,
        }
      );

      await this.client.connect();
      logger.info('Telegram client connected');

      // Send code request - apiId and apiHash are already in the client
      logger.info('Sending Api.auth.SendCode', {
        phoneNumber: phone,
      });
      const sentCode = await this.client.invoke(
        new Api.auth.SendCode({
          phoneNumber: phone,
          apiId: apiIdNum,
          apiHash: TELEGRAM_API_HASH,
          settings: new Api.CodeSettings({}),
        })
      );

      if (sentCode instanceof Api.auth.SentCode) {
        logger.info(`Auth code sent to ${phone}`);
        this.status.phoneNumber = phone;
        // Store the phone code hash for verification
        this.phoneCodeHash = sentCode.phoneCodeHash;
        this.emit('statusChange', this.status);
        return {
          success: true,
          message: `Verification code sent to ${phone}`,
        };
      }

      return {
        success: false,
        message: 'Failed to send verification code',
      };
    } catch (error) {
      logger.error('Error requesting auth code', { error, stack: error instanceof Error ? error.stack : 'unknown' });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to request code',
      };
    }
  }

  /**
   * Verify the code and complete authentication
   */
  async verifyCode(code: string): Promise<{ success: boolean; session?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized. Please request a code first.' };
    }

    if (!this.stringSession) {
      return { success: false, error: 'Session not initialized. Please request a code first.' };
    }

    if (!this.phoneCodeHash) {
      return { success: false, error: 'Phone code hash not found. Please request a code first.' };
    }

    try {
      logger.info('Verifying Telegram code', { phoneNumber: this.status.phoneNumber });
      
      const auth = await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: this.status.phoneNumber || TELEGRAM_PHONE,
          phoneCode: code,
          phoneCodeHash: this.phoneCodeHash,
        })
      );

      if (auth instanceof Api.auth.Authorization) {
        const sessionString = this.stringSession.save();
        this.saveSession(sessionString);

        this.status.connected = true;
        this.status.authenticated = true;
        this.status.error = undefined;
        this.emit('statusChange', this.status);

        logger.info('Telegram authentication successful');
        this.emit('authenticated');

        // Start listening for messages
        this.listenForMessages();

        return { success: true, session: sessionString };
      }

      return { success: false, error: 'Invalid authentication response' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Invalid code';
      logger.error('Error verifying code', { error, stack: error instanceof Error ? error.stack : 'unknown', codeLength: code.length });
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  private loadSession(): string {
    try {
      const sessionPath = join(process.cwd(), SESSION_FILE_PATH);
      if (existsSync(sessionPath)) {
        const data = readFileSync(sessionPath, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.sessionString || '';
      }
    } catch (error) {
      logger.warn('Could not load session', { error });
    }
    return '';
  }

  saveSession(sessionString: string): void {
    try {
      const sessionDir = dirname(join(process.cwd(), SESSION_FILE_PATH));
      if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true });
      }

      const sessionPath = join(process.cwd(), SESSION_FILE_PATH);
      writeFileSync(sessionPath, JSON.stringify({ sessionString, savedAt: new Date().toISOString() }, null, 2));
      logger.info('Session saved');
    } catch (error) {
      logger.error('Failed to save session', { error });
    }
  }

  private listenForMessages(): void {
    if (!this.client) {
      logger.warn('Cannot listen for messages - client not initialized');
      return;
    }

    this.client.addEventHandler((event: NewMessageEvent) => {
      const message = event.message;
      this.handleNewMessage(message);
    });

    logger.info(`Listening for messages from channel ${TELEGRAM_CHANNEL_ID}`);
  }

  private async handleNewMessage(message: unknown): Promise<void> {
    // Check if message is from our configured channel
    const msg = message as { chatId?: number | string; message?: string; id: number };
    const chatId = msg?.chatId?.toString() || '';
    if (chatId !== TELEGRAM_CHANNEL_ID && chatId !== TELEGRAM_CHANNEL_ID.replace('-', '')) {
      return;
    }

    const text = msg.message;
    if (!text) {
      return;
    }

    logger.info('New message from channel', { messageId: msg.id, text: text.substring(0, 100) });

    // Parse the signal
    const parsedSignal = this.parseSignal(text, msg.id, false);
    if (parsedSignal) {
      logger.info('Parsed signal', { parsedSignal });
      this.emit('signal', parsedSignal);
    }
  }

  /**
   * Parse a message using configured templates
   */
  parseSignal(text: string, messageId: number, isEdit: boolean): ParsedSignal | null {
    if (!tradeTemplates) {
      return null;
    }
    
    // Try SL/TP template first (more specific)
    const sltpParsed = this.parseWithTemplate(text, tradeTemplates.sltpSignalTemplate);
    if (sltpParsed) {
      return {
        ...sltpParsed,
        messageId,
        isEdit,
        rawMessage: text,
      } as ParsedSignal;
    }

    // Try entry signal template
    const entryParsed = this.parseWithTemplate(text, tradeTemplates.entrySignalTemplate);
    if (entryParsed) {
      return {
        ...entryParsed,
        messageId,
        isEdit,
        rawMessage: text,
      } as ParsedSignal;
    }

    return null;
  }

  private parseWithTemplate(
    text: string,
    template: Record<string, unknown>
  ): Partial<ParsedSignal> | null {
    try {
      const pattern = template.pattern as string | undefined;
      const flags = template.flags as string | undefined;
      
      if (!pattern) {
        return null;
      }
      
      const regex = new RegExp(pattern, flags || 'i');
      const match = text.match(regex);

      if (!match) {
        return null;
      }

      const result: Partial<ParsedSignal> = {};
      const extractionRules = template.extractionRules as Record<string, { group: number; transform?: string; mapping?: Record<string, string> }> | undefined;

      if (!extractionRules) {
        return result;
      }

      // Apply extraction rules
      for (const [field, rule] of Object.entries(extractionRules)) {
        const groupValue = match[rule.group];
        if (groupValue === undefined) {
          continue;
        }

        let transformedValue: unknown = groupValue;

        // Apply transformation
        switch (rule.transform) {
          case 'uppercase':
            transformedValue = groupValue.toUpperCase();
            break;
          case 'parseFloat':
            transformedValue = parseFloat(groupValue);
            break;
          case 'parseRange':
            const rangeMatch = groupValue.match(/([\d.]+)\s*-\s*([\d.]+)/);
            if (rangeMatch) {
              transformedValue = {
                min: parseFloat(rangeMatch[1]),
                max: parseFloat(rangeMatch[2]),
              };
            } else {
              transformedValue = parseFloat(groupValue);
            }
            break;
        }

        // Apply mapping if exists
        if (rule.mapping && typeof transformedValue === 'string') {
          transformedValue = rule.mapping[transformedValue] || transformedValue;
        }

        result[field as keyof ParsedSignal] = transformedValue as never;
      }

      return result;
    } catch (error) {
      logger.error('Error parsing with template', { error, template: template.description });
      return null;
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.status.connected = false;
      this.status.authenticated = false;
      this.emit('statusChange', this.status);
      logger.info('Telegram client disconnected');
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo(): Promise<{ id: string; title: string } | null> {
    if (!this.client || !TELEGRAM_CHANNEL_ID) {
      return null;
    }

    try {
      const entity = await this.client.getEntity(TELEGRAM_CHANNEL_ID);
      const title = (entity as unknown as { title?: string }).title || 'Unknown';
      return {
        id: entity.id.toString(),
        title,
      };
    } catch (error) {
      logger.error('Error getting channel info', { error });
      return null;
    }
  }
}

export const telegramService = new TelegramService();
