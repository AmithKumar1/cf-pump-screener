import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DB_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "pump_launches.db");

export interface LocalD1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

export class LocalD1PreparedStatement {
  private db: DatabaseSync;
  public readonly sql: string;
  public readonly params: any[];

  constructor(db: DatabaseSync, sql: string, params: any[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params: any[]): LocalD1PreparedStatement {
    return new LocalD1PreparedStatement(this.db, this.sql, params);
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    try {
      const stmt = this.db.prepare(this.sql);
      const row = stmt.get(...this.params) as Record<string, any> | undefined;
      if (!row) return null;
      if (colName) return (row[colName] as T) ?? null;
      return row as T;
    } catch (err: unknown) {
      console.error(`LocalD1.first error on [${this.sql}]:`, err);
      throw err;
    }
  }

  async all<T = unknown>(): Promise<LocalD1Result<T>> {
    try {
      const start = performance.now();
      const stmt = this.db.prepare(this.sql);
      const rows = stmt.all(...this.params) as T[];
      return {
        results: rows,
        success: true,
        meta: {
          duration: performance.now() - start,
          changes: 0,
          last_row_id: 0,
          rows_read: rows.length,
          rows_written: 0,
        },
      };
    } catch (err: unknown) {
      console.error(`LocalD1.all error on [${this.sql}]:`, err);
      throw err;
    }
  }

  async run<T = unknown>(): Promise<{ success: boolean; meta: any }> {
    try {
      const start = performance.now();
      const stmt = this.db.prepare(this.sql);
      const res = stmt.run(...this.params);
      return {
        success: true,
        meta: {
          duration: performance.now() - start,
          changes: res.changes,
          last_row_id: Number(res.lastInsertRowid),
          rows_read: 0,
          rows_written: res.changes,
        },
      };
    } catch (err: unknown) {
      console.error(`LocalD1.run error on [${this.sql}]:`, err);
      throw err;
    }
  }
}

export class LocalD1Database {
  public readonly db: DatabaseSync;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  prepare(sql: string): LocalD1PreparedStatement {
    return new LocalD1PreparedStatement(this.db, sql);
  }

  async batch<T = unknown>(statements: LocalD1PreparedStatement[]): Promise<any[]> {
    this.db.exec("BEGIN TRANSACTION;");
    try {
      const results = [];
      for (const stmt of statements) {
        const res = await stmt.run();
        results.push(res);
      }
      this.db.exec("COMMIT;");
      return results;
    } catch (err) {
      this.db.exec("ROLLBACK;");
      console.error("LocalD1.batch transaction rollback:", err);
      throw err;
    }
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }
}
