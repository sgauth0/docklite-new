import type { Migration } from './types';
import type Database from 'better-sqlite3';

export const version = '008';
export const name = 'create_dns_system';

export function up(db: Database.Database): void {
  // Cloudflare configuration (API token, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloudflare_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      api_token TEXT,
      account_id TEXT,
      enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize with empty config
  db.exec(`
    INSERT OR IGNORE INTO cloudflare_config (id, enabled) VALUES (1, 0)
  `);

  // DNS zones (Cloudflare zones mapped to domains)
  db.exec(`
    CREATE TABLE IF NOT EXISTS dns_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      zone_id TEXT NOT NULL,
      account_id TEXT,
      enabled INTEGER DEFAULT 1,
      last_synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // DNS records cache (synced from Cloudflare)
  db.exec(`
    CREATE TABLE IF NOT EXISTS dns_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      cloudflare_record_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA')),
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      ttl INTEGER DEFAULT 1,
      priority INTEGER,
      proxied INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (zone_id) REFERENCES dns_zones(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dns_records_zone
    ON dns_records(zone_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dns_records_type
    ON dns_records(type)
  `);

  console.log('✓ Created DNS management tables (cloudflare_config, dns_zones, dns_records)');
}

export function down(db: Database.Database): void {
  db.exec('DROP INDEX IF EXISTS idx_dns_records_type');
  db.exec('DROP INDEX IF EXISTS idx_dns_records_zone');
  db.exec('DROP TABLE IF EXISTS dns_records');
  db.exec('DROP TABLE IF EXISTS dns_zones');
  db.exec('DROP TABLE IF EXISTS cloudflare_config');
  console.log('✓ Dropped DNS management tables');
}
