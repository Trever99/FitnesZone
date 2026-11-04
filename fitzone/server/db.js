import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(__dirname, '..', 'data')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

export const db = new DatabaseSync(path.join(DATA_DIR, 'fitzone.db'))

// node:sqlite has no .pragma()/.transaction() helpers like better-sqlite3, so
// provide thin shims to keep the rest of the codebase unchanged.
try { db.exec('PRAGMA journal_mode = DELETE') } catch {}
try { db.exec('PRAGMA foreign_keys = ON') } catch {}

db.transaction = (fn) => () => {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    try { db.exec('ROLLBACK') } catch {}
    throw e
  }
}

export const nu = (v) => (v === undefined || v === null || v === '' ? null : v)
export const today = () => new Date().toISOString().slice(0, 10)
export const dayStart = (d) => new Date(d + 'T00:00:00')