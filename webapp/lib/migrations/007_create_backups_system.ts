import type { Migration } from './types';
import type Database from 'better-sqlite3';

export const version = '007';
export const name = 'create_backups_system';

export function up(db: Database.Database): void {
  // Backup destinations (where backups are stored)
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('local', 'sftp', 's3', 'gdrive', 'backblaze')),
      config TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Backup jobs (what to backup, where, and how often)
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('site', 'database', 'all-sites', 'all-databases')),
      target_id INTEGER,
      frequency TEXT NOT NULL,
      retention_days INTEGER DEFAULT 30,
      enabled INTEGER DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (destination_id) REFERENCES backup_destinations(id) ON DELETE CASCADE
    )
  `);

  // Backup history (records of completed backups)
  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER,
      destination_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('site', 'database')),
      target_id INTEGER NOT NULL,
      backup_path TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'in_progress')) DEFAULT 'in_progress',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES backup_jobs(id) ON DELETE SET NULL,
      FOREIGN KEY (destination_id) REFERENCES backup_destinations(id) ON DELETE CASCADE
    )
  `);

  // Create default local destination
  db.exec(`
    INSERT INTO backup_destinations (name, type, config, enabled)
    VALUES ('Local Server', 'local', '{"path":"/var/backups/docklite"}', 1)
  `);

  console.log('✓ Created backup system tables (destinations, jobs, backups)');
  console.log('✓ Created default local backup destination');
}

export function down(db: Database.Database): void {
  db.exec('DROP TABLE IF EXISTS backups');
  db.exec('DROP TABLE IF EXISTS backup_jobs');
  db.exec('DROP TABLE IF EXISTS backup_destinations');
  console.log('✓ Dropped backup system tables');
}
