import type Database from 'better-sqlite3';

export const version = '014';
export const name = 'create_tokens';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_fingerprint TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      role TEXT,
      scopes TEXT,
      issued_for TEXT,
      disabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      expires_at DATETIME,
      revoked_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_tokens_fingerprint ON tokens(token_fingerprint)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id)`);
  console.log('✓ Created tokens table');
}

export function down(db: Database.Database): void {
  db.exec(`DROP TABLE IF EXISTS tokens`);
  console.log('✓ Dropped tokens table');
}
