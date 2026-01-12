import type Database from 'better-sqlite3';

export const version = '009';
export const name = 'add_container_positions';

export function up(db: Database.Database): void {
  // Add position column to folder_containers table
  // SQLite doesn't allow adding NOT NULL columns without a default,
  // so we add it as nullable first, populate it, then we can enforce it
  db.exec(`
    ALTER TABLE folder_containers
    ADD COLUMN position INTEGER
  `);

  // Assign positions to existing containers based on created_at order
  // Group by folder_id and order by created_at within each folder
  const folders = db.prepare('SELECT DISTINCT folder_id FROM folder_containers').all() as { folder_id: number }[];

  for (const { folder_id } of folders) {
    const containers = db.prepare(`
      SELECT id, container_id
      FROM folder_containers
      WHERE folder_id = ?
      ORDER BY created_at ASC
    `).all(folder_id) as { id: number; container_id: string }[];

    const updatePosition = db.prepare('UPDATE folder_containers SET position = ? WHERE id = ?');

    containers.forEach((container, index) => {
      updatePosition.run(index, container.id);
    });
  }

  // Create index on (folder_id, position) for efficient ordering queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_folder_containers_position
    ON folder_containers(folder_id, position)
  `);

  console.log('✓ Added position column to folder_containers and migrated existing data');
}

export function down(db: Database.Database): void {
  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
  db.exec(`
    -- Create new table without position column
    CREATE TABLE folder_containers_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL,
      container_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
      UNIQUE(folder_id, container_id)
    )
  `);

  // Copy data back
  db.exec(`
    INSERT INTO folder_containers_new (id, folder_id, container_id, created_at)
    SELECT id, folder_id, container_id, created_at
    FROM folder_containers
  `);

  // Drop old table and rename new one
  db.exec(`DROP TABLE folder_containers`);
  db.exec(`ALTER TABLE folder_containers_new RENAME TO folder_containers`);

  // Recreate original indexes
  db.exec(`CREATE INDEX idx_folder_containers_folder_id ON folder_containers(folder_id)`);
  db.exec(`CREATE INDEX idx_folder_containers_container_id ON folder_containers(container_id)`);

  console.log('✓ Removed position column from folder_containers');
}
