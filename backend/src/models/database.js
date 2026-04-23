import initSqlJs from 'sql.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config } from '../config.js';

let db = null;

export async function initDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (existsSync(config.DB_PATH)) {
    const fileBuffer = readFileSync(config.DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  initSchema();
  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  writeFileSync(config.DB_PATH, Buffer.from(data));
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      media_refs TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      thumbnail_path TEXT,
      metadata TEXT DEFAULT '{}',
      analysis TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
  persist();
}

function queryAll(sql, params = []) {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  db.run(sql, params);
  persist();
}

export const conversationModel = {
  create(id, title = 'New Conversation') {
    run(`INSERT INTO conversations (id, title) VALUES (?, ?)`, [id, title]);
    return this.findById(id);
  },
  findAll() {
    return queryAll(`SELECT * FROM conversations ORDER BY updated_at DESC`);
  },
  findById(id) {
    return queryOne(`SELECT * FROM conversations WHERE id = ?`, [id]);
  },
  touch(id) {
    run(`UPDATE conversations SET updated_at = strftime('%s','now') WHERE id = ?`, [id]);
  },
  delete(id) {
    run(`DELETE FROM conversations WHERE id = ?`, [id]);
  },
};

export const messageModel = {
  create(id, conversationId, role, content, mediaRefs = []) {
    run(
      `INSERT INTO messages (id, conversation_id, role, content, media_refs) VALUES (?, ?, ?, ?, ?)`,
      [id, conversationId, role, content, JSON.stringify(mediaRefs)]
    );
    return this.findById(id);
  },
  findById(id) {
    const msg = queryOne(`SELECT * FROM messages WHERE id = ?`, [id]);
    if (msg) msg.media_refs = JSON.parse(msg.media_refs || '[]');
    return msg;
  },
  findByConversation(conversationId) {
    const msgs = queryAll(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId]
    );
    return msgs.map(m => ({ ...m, media_refs: JSON.parse(m.media_refs || '[]') }));
  },
  deleteByConversation(conversationId) {
    run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);
  },
};

export const mediaModel = {
  create(data) {
    run(
      `INSERT INTO media_files (id, original_name, filename, mime_type, media_type, size, path, thumbnail_path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id, data.original_name, data.filename, data.mime_type,
        data.media_type, data.size, data.path,
        data.thumbnail_path || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return this.findById(data.id);
  },
  findById(id) {
    const m = queryOne(`SELECT * FROM media_files WHERE id = ?`, [id]);
    if (m) m.metadata = JSON.parse(m.metadata || '{}');
    return m;
  },
  updateAnalysis(id, analysis) {
    const val = typeof analysis === 'string' ? analysis : JSON.stringify(analysis);
    run(`UPDATE media_files SET analysis = ? WHERE id = ?`, [val, id]);
  },
  updateThumbnail(id, thumbnailPath) {
    run(`UPDATE media_files SET thumbnail_path = ? WHERE id = ?`, [thumbnailPath, id]);
  },
  findOlderThan(hours) {
    const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
    return queryAll(`SELECT * FROM media_files WHERE created_at < ?`, [cutoff]);
  },
  delete(id) {
    run(`DELETE FROM media_files WHERE id = ?`, [id]);
  },
};

export default { initDb, conversationModel, messageModel, mediaModel };