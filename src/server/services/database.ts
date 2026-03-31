import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/trades.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export interface Trade {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING_SL_TP' | 'FAULTED';
  pnlUsd: number | null;
  pnlPercent: number | null;
  exitPrice: number | null;
  exitReason: string | null;
  telegramMessageId: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface EquitySnapshot {
  id: number;
  totalEquity: number;
  totalPnl: number;
  timestamp: string;
}

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema() {
    // Trades table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('BUY', 'SELL')),
        entryPrice REAL NOT NULL,
        stopLoss REAL,
        takeProfit REAL,
        lotSize REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'PENDING_SL_TP', 'FAULTED')),
        pnlUsd REAL,
        pnlPercent REAL,
        exitPrice REAL,
        exitReason TEXT,
        telegramMessageId INTEGER,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        closedAt TEXT
      )
    `);

    // Equity snapshots table for chart
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS equity_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        totalEquity REAL NOT NULL,
        totalPnl REAL NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(createdAt);
      CREATE INDEX IF NOT EXISTS idx_equity_timestamp ON equity_snapshots(timestamp);
    `);
  }

  // Trade operations
  createTrade(trade: Omit<Trade, 'id' | 'createdAt' | 'updatedAt' | 'pnlUsd' | 'pnlPercent' | 'exitPrice' | 'exitReason' | 'closedAt'>): Trade {
    const stmt = this.db.prepare(`
      INSERT INTO trades (symbol, action, entryPrice, stopLoss, takeProfit, lotSize, status, telegramMessageId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      trade.symbol,
      trade.action,
      trade.entryPrice,
      trade.stopLoss,
      trade.takeProfit,
      trade.lotSize,
      trade.status,
      trade.telegramMessageId
    );
    return this.getTradeById(result.lastInsertRowid as number);
  }

  getTradeById(id: number): Trade {
    const stmt = this.db.prepare('SELECT * FROM trades WHERE id = ?');
    return stmt.get(id) as Trade;
  }

  getOpenTrades(): Trade[] {
    const stmt = this.db.prepare("SELECT * FROM trades WHERE status IN ('OPEN', 'PENDING_SL_TP', 'FAULTED') ORDER BY createdAt DESC");
    return stmt.all() as Trade[];
  }

  getClosedTrades(filters?: { from?: string; to?: string; symbol?: string; action?: string }): Trade[] {
    let query = "SELECT * FROM trades WHERE status = 'CLOSED'";
    const params: (string | number)[] = [];

    if (filters) {
      if (filters.from) {
        query += ' AND createdAt >= ?';
        params.push(filters.from);
      }
      if (filters.to) {
        query += ' AND createdAt <= ?';
        params.push(filters.to);
      }
      if (filters.symbol) {
        query += ' AND symbol = ?';
        params.push(filters.symbol);
      }
      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }
    }

    query += ' ORDER BY closedAt DESC';
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Trade[];
  }

  updateTrade(id: number, updates: Partial<Trade>): Trade {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== 'id' && key !== 'createdAt') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return this.getTradeById(id);
    }

    fields.push("updatedAt = datetime('now')");
    values.push(id);

    const stmt = this.db.prepare(`UPDATE trades SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getTradeById(id);
  }

  closeTrade(id: number, exitPrice: number, exitReason: string, pnlUsd: number, pnlPercent: number): Trade {
    const stmt = this.db.prepare(`
      UPDATE trades 
      SET status = 'CLOSED', 
          exitPrice = ?, 
          exitReason = ?, 
          pnlUsd = ?, 
          pnlPercent = ?,
          closedAt = datetime('now'),
          updatedAt = datetime('now')
      WHERE id = ?
    `);
    stmt.run(exitPrice, exitReason, pnlUsd, pnlPercent, id);
    return this.getTradeById(id);
  }

  getFaultedTrades(timeoutMinutes: number): Trade[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades 
      WHERE status = 'OPEN' 
        AND (stopLoss IS NULL OR takeProfit IS NULL)
        AND createdAt <= datetime('now', ? || ' minutes')
      ORDER BY createdAt ASC
    `);
    return stmt.all(`-${timeoutMinutes}`) as Trade[];
  }

  // Equity snapshot operations
  addEquitySnapshot(totalEquity: number, totalPnl: number): EquitySnapshot {
    const stmt = this.db.prepare(`
      INSERT INTO equity_snapshots (totalEquity, totalPnl)
      VALUES (?, ?)
    `);
    const result = stmt.run(totalEquity, totalPnl);
    return this.getEquitySnapshotById(result.lastInsertRowid as number);
  }

  getEquitySnapshotById(id: number): EquitySnapshot {
    const stmt = this.db.prepare('SELECT * FROM equity_snapshots WHERE id = ?');
    return stmt.get(id) as EquitySnapshot;
  }

  getEquityHistory(range: '1D' | '1W' | '1M' | 'ALL' = '1W'): EquitySnapshot[] {
    let timeFilter: string;
    switch (range) {
      case '1D':
        timeFilter = "datetime('now', '-1 day')";
        break;
      case '1W':
        timeFilter = "datetime('now', '-7 days')";
        break;
      case '1M':
        timeFilter = "datetime('now', '-1 month')";
        break;
      default:
        timeFilter = "datetime('2000-01-01')";
    }

    const stmt = this.db.prepare(`
      SELECT * FROM equity_snapshots 
      WHERE timestamp >= ${timeFilter}
      ORDER BY timestamp ASC
    `);
    return stmt.all() as EquitySnapshot[];
  }

  // Summary operations
  getTotalPnL(): { totalPnlUsd: number; totalPnlPercent: number; todayPnlUsd: number } {
    const totalStmt = this.db.prepare(`
      SELECT 
        COALESCE(SUM(pnlUsd), 0) as totalPnlUsd,
        COALESCE(SUM(pnlPercent), 0) as totalPnlPercent
      FROM trades WHERE status = 'CLOSED'
    `);
    const todayStmt = this.db.prepare(`
      SELECT COALESCE(SUM(pnlUsd), 0) as todayPnlUsd
      FROM trades 
      WHERE status = 'CLOSED' 
        AND date(closedAt) = date('now')
    `);

    const total = totalStmt.get() as { totalPnlUsd: number; totalPnlPercent: number };
    const today = todayStmt.get() as { todayPnlUsd: number };

    return {
      totalPnlUsd: total.totalPnlUsd,
      totalPnlPercent: total.totalPnlPercent,
      todayPnlUsd: today.todayPnlUsd,
    };
  }

  // Cleanup old equity snapshots (keep last 30 days)
  cleanupOldSnapshots(): void {
    const stmt = this.db.prepare(`
      DELETE FROM equity_snapshots 
      WHERE timestamp < datetime('now', '-30 days')
    `);
    stmt.run();
  }

  close() {
    this.db.close();
  }
}

export const db = new DatabaseService();
