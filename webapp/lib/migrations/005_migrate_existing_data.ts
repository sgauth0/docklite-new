import type Database from 'better-sqlite3';

export const version = '005';
export const name = 'migrate_existing_data';

export function up(db: Database.Database): void {
  // Step 1: Migrate user roles
  // Find admin user with id=1 and set as super_admin
  db.exec(`
    UPDATE users
    SET role = CASE
      WHEN id = 1 AND is_admin = 1 THEN 'super_admin'
      WHEN is_admin = 1 THEN 'admin'
      ELSE 'user'
    END,
    is_super_admin = CASE WHEN id = 1 AND is_admin = 1 THEN 1 ELSE 0 END
  `);

  console.log('✓ Migrated user roles (admin user → super_admin)');

  // Step 2: Calculate and store code_path for existing sites
  const sites = db.prepare(`
    SELECT s.id, s.domain, u.username
    FROM sites s
    JOIN users u ON s.user_id = u.id
  `).all() as Array<{id: number, domain: string, username: string}>;

  const updateStmt = db.prepare(`UPDATE sites SET code_path = ? WHERE id = ?`);

  for (const site of sites) {
    const codePath = `/var/www/sites/${site.username}/${site.domain}`;
    updateStmt.run(codePath, site.id);
  }

  console.log(`✓ Calculated code_path for ${sites.length} existing sites`);

  // Step 3: Create default folders for all users
  const users = db.prepare(`SELECT id, username FROM users`).all() as Array<{id: number, username: string}>;
  const insertFolder = db.prepare(`INSERT INTO folders (user_id, name) VALUES (?, ?)`);

  for (const user of users) {
    insertFolder.run(user.id, 'Default');
  }

  console.log(`✓ Created Default folders for ${users.length} users`);

  // Step 4: Link existing sites to their user's Default folder
  db.exec(`
    UPDATE sites
    SET folder_id = (
      SELECT f.id
      FROM folders f
      WHERE f.user_id = sites.user_id
      AND f.name = 'Default'
    )
  `);

  const sitesLinked = db.prepare(`SELECT COUNT(*) as count FROM sites WHERE folder_id IS NOT NULL`).get() as {count: number};
  console.log(`✓ Linked ${sitesLinked.count} sites to Default folders`);

  // Step 5: Link existing site containers to Default folders
  db.exec(`
    INSERT INTO folder_containers (folder_id, container_id)
    SELECT s.folder_id, s.container_id
    FROM sites s
    WHERE s.container_id IS NOT NULL
    AND s.folder_id IS NOT NULL
  `);

  const containersLinked = db.prepare(`SELECT COUNT(*) as count FROM folder_containers`).get() as {count: number};
  console.log(`✓ Linked ${containersLinked.count} containers to folders`);
}

export function down(db: Database.Database): void {
  // Revert user roles
  db.exec(`UPDATE users SET role = NULL, is_super_admin = 0, managed_by = NULL`);

  // Clear site extensions
  db.exec(`UPDATE sites SET code_path = NULL, folder_id = NULL`);

  // Clear folders data
  db.exec(`DELETE FROM folder_containers`);
  db.exec(`DELETE FROM folders`);

  console.log('✓ Reverted data migration');
}
