import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import db from '@/lib/db';
import { listContainers } from '@/lib/docker';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireAdmin();

    const containers = await listContainers(true);
    const containerIds = new Set(containers.map(container => container.id));

    const sites = db.prepare('SELECT id, container_id FROM sites').all() as Array<{ id: number; container_id: string | null }>;
    const databases = db.prepare('SELECT id, container_id FROM databases').all() as Array<{ id: number; container_id: string | null }>;

    let removedSites = 0;
    let removedDatabases = 0;

    const deleteSite = db.prepare('DELETE FROM sites WHERE id = ?');
    const deleteDatabase = db.prepare('DELETE FROM databases WHERE id = ?');
    const deleteDatabasePermissions = db.prepare('DELETE FROM database_permissions WHERE database_id = ?');

    for (const site of sites) {
      if (!site.container_id || !containerIds.has(site.container_id)) {
        deleteSite.run(site.id);
        removedSites += 1;
      }
    }

    for (const database of databases) {
      if (!database.container_id || !containerIds.has(database.container_id)) {
        deleteDatabasePermissions.run(database.id);
        deleteDatabase.run(database.id);
        removedDatabases += 1;
      }
    }

    db.prepare(`
      DELETE FROM database_permissions
      WHERE user_id NOT IN (SELECT id FROM users)
         OR database_id NOT IN (SELECT id FROM databases)
    `).run();

    return NextResponse.json({
      removed: {
        sites: removedSites,
        databases: removedDatabases,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error cleaning database:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
