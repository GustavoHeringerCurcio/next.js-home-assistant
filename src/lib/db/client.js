import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

let db

const defaultDbPath = path.join(process.cwd(), ".data", "tuya-agent.sqlite")

function normalizeSql(sql) {
  return sql.replace(/\$(\d+)/g, "?")
}

function ensureSchema(activeDb) {
  activeDb.exec(`
    create table if not exists messages (
      id integer primary key autoincrement,
      conversation_id text not null,
      role text not null check (role in ('user', 'assistant', 'system', 'developer', 'tool')),
      content text not null,
      metadata text not null default '{}',
      created_at text not null default (datetime('now'))
    );

    create table if not exists memories (
      id integer primary key autoincrement,
      content text not null,
      tags text not null default '[]',
      importance real not null default 0.5,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create index if not exists messages_conversation_created_idx
      on messages (conversation_id, created_at);

    create index if not exists memories_content_idx
      on memories (content);
  `)
}

export function getDb() {
  if (db) {
    return db
  }

  const dbPath = process.env.LOCAL_SQLITE_PATH || defaultDbPath
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  ensureSchema(db)

  return db
}

export async function query(sql, params = []) {
  const activeDb = getDb()
  const normalized = normalizeSql(sql)
  const trimmed = normalized.trim().toLowerCase()
  const statement = activeDb.prepare(normalized)

  if (trimmed.startsWith("select")) {
    return {
      rows: statement.all(params),
      rowCount: 0,
    }
  }

  if (trimmed.includes(" returning ")) {
    const row = statement.get(params)
    return {
      rows: row ? [row] : [],
      rowCount: row ? 1 : 0,
    }
  }

  const result = statement.run(params)
  return {
    rows: [],
    rowCount: result.changes,
    lastInsertRowid: result.lastInsertRowid,
  }
}
