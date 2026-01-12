import type Database from 'better-sqlite3';

export const version = '010';
export const name = 'add_nested_folders';

export function up(db: Database.Database): void {
  // Add columns for nested folder support
  db.exec(`
    ALTER TABLE folders
    ADD COLUMN parent_folder_id INTEGER NULL
    REFERENCES folders(id) ON DELETE CASCADE
  `);

  db.exec(`
    ALTER TABLE folders
    ADD COLUMN depth INTEGER DEFAULT 0
  `);

  db.exec(`
    ALTER TABLE folders
    ADD COLUMN position INTEGER DEFAULT 0
  `);

  // Initialize positions for existing folders (order by name within each user)
  const users = db.prepare('SELECT DISTINCT user_id FROM folders').all() as { user_id: number }[];

  for (const { user_id } of users) {
    const folders = db.prepare(`
      SELECT id, name
      FROM folders
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(user_id) as { id: number; name: string }[];

    const updatePosition = db.prepare('UPDATE folders SET position = ? WHERE id = ?');

    folders.forEach((folder, index) => {
      updatePosition.run(index, folder.id);
    });
  }

  // Create indexes for efficient queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_folders_parent
    ON folders(parent_folder_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_folders_parent_position
    ON folders(parent_folder_id, position)
  `);

  console.log('✓ Added nested folder support (parent_folder_id, depth, position)');
}

export function down(db: Database.Database): void {
  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
  db.exec(`
    -- Create new table without nested folder columns
    CREATE TABLE folders_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  // Copy data back
  db.exec(`
    INSERT INTO folders_new (id, user_id, name, created_at)
    SELECT id, user_id, name, created_at
    FROM folders
  `);

  // Drop old table and rename new one
  db.exec(`DROP TABLE folders`);
  db.exec(`ALTER TABLE folders_new RENAME TO folders`);

  // Recreate original index
  db.exec(`CREATE INDEX idx_folders_user_id ON folders(user_id)`);

  console.log('✓ Removed nested folder support');
}
