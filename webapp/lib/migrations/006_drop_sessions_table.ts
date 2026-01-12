import type Database from 'better-sqlite3';

export const version = '006';
export const name = 'drop_sessions_table';

export function up(db: Database.Database): void {
  // Verify sessions table is actually unused
  const count = db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as {count: number};

  if (count.count > 0) {
    console.warn(`⚠️  WARNING: Sessions table has ${count.count} records. Session storage uses iron-session cookies instead.`);
  }

  db.exec(`DROP TABLE IF EXISTS sessions`);
  console.log('✓ Dropped unused sessions table');
}

export function down(db: Database.Database): void {
  // Recreate sessions table
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('✓ Recreated sessions table');
}
