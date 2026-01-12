import type Database from 'better-sqlite3';

export const version = '004';
export const name = 'create_folders_system';

export function up(db: Database.Database): void {
  // Create folders table
  db.exec(`
    CREATE TABLE folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  db.exec(`CREATE INDEX idx_folders_user_id ON folders(user_id)`);

  // Create folder_containers junction table
  db.exec(`
    CREATE TABLE folder_containers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL,
      container_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
      UNIQUE(folder_id, container_id)
    )
  `);

  db.exec(`CREATE INDEX idx_folder_containers_folder_id ON folder_containers(folder_id)`);
  db.exec(`CREATE INDEX idx_folder_containers_container_id ON folder_containers(container_id)`);

  console.log('✓ Created folders and folder_containers tables');
}

export function down(db: Database.Database): void {
  db.exec(`DROP TABLE IF EXISTS folder_containers`);
  db.exec(`DROP TABLE IF EXISTS folders`);

  console.log('✓ Dropped folders system');
}
