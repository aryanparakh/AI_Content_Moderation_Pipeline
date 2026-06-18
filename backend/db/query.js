/**
 * sql.js query helpers — wraps the verbose sql.js API into a
 * better-sqlite3-like interface: get(), all(), run().
 *
 * sql.js exec() returns: [{ columns: string[], values: any[][] }]
 * We convert those to plain objects for convenience.
 */

import { getDb, saveDb } from './database.js';

/** Convert a sql.js result set row into a plain JS object. */
function rowToObj(columns, row) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

/** Execute a SELECT and return the first matching row, or undefined. */
export function dbGet(sql, params = []) {
  const db = getDb();
  const results = db.exec(sql, params);
  if (!results.length || !results[0].values.length) return undefined;
  return rowToObj(results[0].columns, results[0].values[0]);
}

/** Execute a SELECT and return all matching rows as an array of objects. */
export function dbAll(sql, params = []) {
  const db = getDb();
  const results = db.exec(sql, params);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) => rowToObj(columns, row));
}

/** Execute an INSERT / UPDATE / DELETE and persist the database to disk. */
export function dbRun(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDb();
}

/** Execute raw DDL or multi-statement SQL. */
export function dbExec(sql) {
  const db = getDb();
  db.run(sql);
  saveDb();
}
