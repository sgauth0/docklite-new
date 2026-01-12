import type Database from 'better-sqlite3';

export const version = '001';
export const name = 'initial_schema_baseline';

export function up(db: Database.Database): void {
  // No-op: Just record that we're starting from current schema
  console.log('✓ Baseline schema recorded');
}

export function down(db: Database.Database): void {
  throw new Error('Cannot rollback initial schema');
}
