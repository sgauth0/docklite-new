import type Database from 'better-sqlite3';

export const version = '002';
export const name = 'add_user_roles';

export function up(db: Database.Database): void {
  // Step 1: Add new columns (all nullable initially)
  db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT NULL`);
  db.exec(`ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0`);
  db.exec(`ALTER TABLE users ADD COLUMN managed_by INTEGER DEFAULT NULL`);

  // Step 2: Create index for managed_by foreign key
  db.exec(`CREATE INDEX idx_users_managed_by ON users(managed_by)`);

  console.log('✓ Added role, is_super_admin, managed_by columns to users');
}

export function down(db: Database.Database): void {
  // SQLite doesn't support DROP COLUMN before 3.35.0
  // Workaround: Create new table without columns, copy data, swap tables

  db.exec(`
    CREATE TABLE users_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    INSERT INTO users_old (id, username, password_hash, is_admin, created_at)
    SELECT id, username, password_hash, is_admin, created_at FROM users
  `);

  db.exec(`DROP TABLE users`);
  db.exec(`ALTER TABLE users_old RENAME TO users`);

  console.log('✓ Rolled back user roles');
}
