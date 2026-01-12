import type Database from 'better-sqlite3';

export const version = '012';
export const name = 'rename_admin_user';

export function up(db: Database.Database): void {
  const hasSuperadmin = db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1').get('superadmin');
  const hasAdmin = db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1').get('admin');

  if (!hasSuperadmin && hasAdmin) {
    db.prepare(`
      UPDATE users
      SET username = 'superadmin'
      WHERE username = 'admin'
    `).run();
    console.log('✓ Renamed admin user to superadmin');
  }
}

export function down(db: Database.Database): void {
  const hasAdmin = db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1').get('admin');
  const hasSuperadmin = db.prepare('SELECT 1 FROM users WHERE username = ? LIMIT 1').get('superadmin');

  if (!hasAdmin && hasSuperadmin) {
    db.prepare(`
      UPDATE users
      SET username = 'admin'
      WHERE username = 'superadmin'
    `).run();
  }
}
