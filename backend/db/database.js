import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seedDefaultPolicies } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'moderation.db');

let db = null;

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

/** Persist the in-memory sql.js database to disk. */
export function saveDb() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

export async function initDb() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log(`✅ SQLite database loaded from: ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log(`✅ SQLite database created at: ${DB_PATH}`);
  }

  db.run('PRAGMA foreign_keys = ON');
  createTables();
  seedDefaultPolicies(db);
  saveDb();
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS platforms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS category_policies (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id           TEXT    NOT NULL,
      category              TEXT    NOT NULL,
      enabled               INTEGER NOT NULL DEFAULT 1,
      review_threshold      REAL    NOT NULL DEFAULT 0.45,
      auto_action_threshold REAL    NOT NULL DEFAULT 0.85,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
      UNIQUE(platform_id, category)
    );

    CREATE TABLE IF NOT EXISTS custom_rules (
      id          TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL,
      description TEXT,
      contains    TEXT NOT NULL,
      category    TEXT NOT NULL,
      action      TEXT NOT NULL,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_records (
      id                TEXT PRIMARY KEY,
      content           TEXT NOT NULL,
      platform_id       TEXT NOT NULL,
      surface           TEXT,
      user_history      TEXT,
      thread            TEXT    DEFAULT '[]',
      flags             TEXT    DEFAULT '[]',
      overall_reasoning TEXT,
      context_notes     TEXT,
      model_used        TEXT,
      latency_ms        INTEGER,
      action            TEXT    NOT NULL,
      routing           TEXT    NOT NULL,
      per_flag          TEXT    DEFAULT '[]',
      primary_flag      TEXT,
      decision_summary  TEXT,
      policy_id         TEXT,
      policy_name       TEXT,
      created_at        TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_outcomes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id    TEXT    NOT NULL UNIQUE,
      reviewer     TEXT    NOT NULL,
      final_action TEXT    NOT NULL,
      overrode_ai  INTEGER NOT NULL DEFAULT 0,
      notes        TEXT,
      reviewed_at  TEXT    NOT NULL,
      FOREIGN KEY (record_id) REFERENCES content_records(id) ON DELETE CASCADE
    );
  `);
}
