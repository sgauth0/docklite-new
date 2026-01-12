import type Database from 'better-sqlite3';

export const version = '011';
export const name = 'promote_admin_super_admin';

export function up(db: Database.Database): void {
  db.exec(`
    UPDATE users
    SET
      role = CASE
        WHEN username = 'admin' THEN 'super_admin'
        WHEN is_admin = 1 THEN 'admin'
        ELSE 'user'
      END,
      is_super_admin = CASE
        WHEN username = 'admin' THEN 1
        ELSE 0
      END,
      is_admin = CASE
        WHEN username = 'admin' THEN 1
        WHEN is_admin = 1 THEN 1
        ELSE 0
      END
  `);

  console.log('✓ Promoted admin user to super_admin and normalized roles');
}

export function down(db: Database.Database): void {
  db.exec(`
    UPDATE users
    SET
      role = CASE
        WHEN is_admin = 1 THEN 'admin'
        ELSE 'user'
      END,
      is_super_admin = 0
  `);
}
