import type Database from 'better-sqlite3';

export interface Migration {
  version: string;
  name: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

export interface MigrationRecord {
  id: number;
  version: string;
  name: string;
  executed_at: string;
  checksum: string;
}
