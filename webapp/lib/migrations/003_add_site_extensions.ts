import type Database from 'better-sqlite3';

export const version = '003';
export const name = 'add_site_extensions';

export function up(db: Database.Database): void {
  // SQLite ALTER TABLE doesn't support DEFAULT with exec, use prepare().run()
  db.prepare(`ALTER TABLE sites ADD COLUMN code_path TEXT`).run();
  db.prepare(`ALTER TABLE sites ADD COLUMN status TEXT`).run();
  db.prepare(`ALTER TABLE sites ADD COLUMN folder_id INTEGER`).run();

  // Set default value for status on existing rows
  db.prepare(`UPDATE sites SET status = 'active' WHERE status IS NULL`).run();

  // Create index for folder_id foreign key
  db.exec(`CREATE INDEX idx_sites_folder_id ON sites(folder_id)`);

  console.log('✓ Added code_path, status, folder_id to sites');
}

export function down(db: Database.Database): void {
  db.exec(`
    CREATE TABLE sites_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      container_id TEXT,
      template_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`
    INSERT INTO sites_old (id, domain, user_id, container_id, template_type, created_at)
    SELECT id, domain, user_id, container_id, template_type, created_at FROM sites
  `);

  db.exec(`DROP TABLE sites`);
  db.exec(`ALTER TABLE sites_old RENAME TO sites`);

  console.log('✓ Rolled back site extensions');
}
