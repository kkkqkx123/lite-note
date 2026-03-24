import Database from 'better-sqlite3'
import path from 'path'

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'app.db')

// Create database connection (singleton)
const db = new Database(DB_PATH, {
  // Enable better concurrency
  fileMustExist: false,
  timeout: 5000, // 5 seconds timeout
})

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000') // 5 seconds busy timeout

// Initialize database schema
function initializeDatabase() {
  // Create notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY UNIQUE,
      title TEXT NOT NULL,
      tags TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC)
  `)
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)
  `)
}

// Initialize database on first import
initializeDatabase()

// Query methods
export const sqlite = {
  // Get a single row
  get<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = db.prepare(sql)
    return stmt.get(...params) as T | undefined
  },

  // Get all rows
  all<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const stmt = db.prepare(sql)
    return stmt.all(...params) as T[]
  },

  // Run a statement (INSERT, UPDATE, DELETE)
  run(sql: string, params: unknown[] = []): Database.RunResult {
    const stmt = db.prepare(sql)
    return stmt.run(...params)
  },

  // Execute multiple statements
  exec(sql: string): void {
    db.exec(sql)
  },

  // Transaction wrapper
  transaction<T>(fn: () => T): T {
    const txn = db.transaction(fn)
    return txn()
  },
}

export default db
