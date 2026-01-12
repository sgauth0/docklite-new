import type Database from 'better-sqlite3';

export function validateMigration(db: Database.Database): boolean {
  const checks = [];

  // 1. All users have roles
  const usersWithoutRole = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role IS NULL`).get() as {count: number};
  checks.push({
    test: 'All users have roles',
    passed: usersWithoutRole.count === 0,
    details: `${usersWithoutRole.count} users without role`
  });

  // 2. Super admin exists
  const superAdmin = db.prepare(`SELECT COUNT(*) as count FROM users WHERE is_super_admin = 1`).get() as {count: number};
  checks.push({
    test: 'Super admin exists',
    passed: superAdmin.count >= 1,
    details: `${superAdmin.count} super admins`
  });

  // 3. All sites have code_path
  const sitesWithoutPath = db.prepare(`SELECT COUNT(*) as count FROM sites WHERE code_path IS NULL`).get() as {count: number};
  checks.push({
    test: 'All sites have code_path',
    passed: sitesWithoutPath.count === 0,
    details: `${sitesWithoutPath.count} sites without code_path`
  });

  // 4. All sites have folder_id
  const sitesWithoutFolder = db.prepare(`SELECT COUNT(*) as count FROM sites WHERE folder_id IS NULL`).get() as {count: number};
  checks.push({
    test: 'All sites assigned to folder',
    passed: sitesWithoutFolder.count === 0,
    details: `${sitesWithoutFolder.count} sites without folder`
  });

  // 5. All users have Default folder
  const usersWithoutFolder = db.prepare(`
    SELECT COUNT(*) as count FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM folders f WHERE f.user_id = u.id AND f.name = 'Default')
  `).get() as {count: number};
  checks.push({
    test: 'All users have Default folder',
    passed: usersWithoutFolder.count === 0,
    details: `${usersWithoutFolder.count} users without Default folder`
  });

  // 6. Sessions table dropped
  const tablesCheck = db.prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='sessions'`).get() as {count: number};
  checks.push({
    test: 'Sessions table dropped',
    passed: tablesCheck.count === 0,
    details: tablesCheck.count > 0 ? 'Sessions table still exists' : 'Table dropped'
  });

  // Print results
  console.log('\n📋 Migration Validation Results:');
  let allPassed = true;
  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.test}: ${check.details}`);
    if (!check.passed) allPassed = false;
  }

  return allPassed;
}
