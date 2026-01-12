import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();

    // Get DockLite main database info
    const dbPath = path.join(process.cwd(), 'data', 'docklite.db');
    let dockliteDbSize = 0;
    let dockliteDbTables = 0;

    try {
      const stats = await fs.stat(dbPath);
      dockliteDbSize = stats.size;

      // Count tables in DockLite database
      const { stdout } = await execAsync(
        `sqlite3 ${dbPath} "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"`
      );
      dockliteDbTables = parseInt(stdout.trim());
    } catch (err) {
      console.error('Error getting DockLite DB stats:', err);
    }

    // Get PostgreSQL databases info (from database records)
    const db = require('@/lib/db').default;
    const databases = db.prepare('SELECT * FROM databases ORDER BY created_at DESC').all();

    // Get sizes for each PostgreSQL database
    const databasesWithSize = await Promise.all(
      databases.map(async (database: any) => {
        let size = 0;
        let sizeCategory = 'empty';

        try {
          // Get container ID
          const containerId = database.container_id;

          // Execute SQL query to get database size
          const { stdout } = await execAsync(
            `docker exec ${containerId} psql -U docklite -d ${database.name} -t -c "SELECT pg_database_size('${database.name}')"`
          );

          size = parseInt(stdout.trim());

          // Categorize size
          if (size === 0) sizeCategory = 'empty';
          else if (size < 1024 * 1024) sizeCategory = 'tiny'; // < 1MB
          else if (size < 10 * 1024 * 1024) sizeCategory = 'small'; // < 10MB
          else if (size < 100 * 1024 * 1024) sizeCategory = 'medium'; // < 100MB
          else if (size < 1024 * 1024 * 1024) sizeCategory = 'large'; // < 1GB
          else sizeCategory = 'huge'; // >= 1GB
        } catch (err) {
          console.error(`Error getting size for ${database.name}:`, err);
        }

        return {
          ...database,
          size,
          sizeCategory,
        };
      })
    );

    return NextResponse.json({
      dockliteDb: {
        size: dockliteDbSize,
        tables: dockliteDbTables,
        path: dbPath,
      },
      databases: databasesWithSize,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting database stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
