import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (3 levels up from dist/server/logger.js)
const envPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const LOG_FILE_PATH = process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/app.log');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_MAX_LINES = parseInt(process.env.LOG_MAX_LINES || '1000', 10);

// Ensure logs directory exists
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console and file
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

// Create logger instance with simple file transport
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: LOG_FILE_PATH,
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    }),
  ],
  exitOnError: false,
});

// Helper function to get recent logs
export function getRecentLogs(level?: string, limit: number = 100): string[] {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      return [];
    }

    const content = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    let filteredLines = lines;
    if (level) {
      const levelUpper = level.toUpperCase();
      filteredLines = lines.filter(line => line.includes(`[${levelUpper}]`));
    }
    
    // Enforce line limit on read
    if (filteredLines.length > LOG_MAX_LINES) {
      const trimmedLines = filteredLines.slice(-LOG_MAX_LINES);
      fs.writeFileSync(LOG_FILE_PATH, trimmedLines.join('\n') + '\n', 'utf-8');
      return trimmedLines;
    }
    
    return filteredLines;
  } catch (error) {
    logger.error('Error reading logs', { error });
    return [];
  }
}

// Helper to clear logs
export function clearLogs(): boolean {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      fs.writeFileSync(LOG_FILE_PATH, '', 'utf-8');
      logger.info('Logs cleared');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error clearing logs', { error });
    return false;
  }
}

export default logger;
