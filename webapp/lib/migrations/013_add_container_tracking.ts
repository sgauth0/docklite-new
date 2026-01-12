import type Database from 'better-sqlite3';
import type { Migration } from './types';

export const name = 'add_container_tracking';
export const version = '013';

export const up: Migration['up'] = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS untracked_containers (
      container_id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_untracked_containers_id ON untracked_containers(container_id)`);
  console.log('✓ Added untracked_containers table');
};

export const down: Migration['down'] = (db: Database.Database) => {
  db.exec(`DROP TABLE IF EXISTS untracked_containers`);
  console.log('✓ Dropped untracked_containers table');
};
