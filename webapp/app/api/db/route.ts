
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (process.env.ENABLE_DB_DEBUG !== 'true') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const sensitiveColumns = new Set(['password_hash']);
    const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const schemaAndData = tables.map((table: any) => {
      const tableName = table.name as string;
      const schema = db.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all();
      const visibleColumns = schema
        .map((col: any) => col.name as string)
        .filter((name: string) => !sensitiveColumns.has(name));
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${quoteIdent(tableName)}`).get() as { count: number };

      let data: any[] = [];
      if (visibleColumns.length > 0) {
        const columnList = visibleColumns.map(quoteIdent).join(', ');
        data = db.prepare(`SELECT ${columnList} FROM ${quoteIdent(tableName)} LIMIT 10`).all() as any[];
      }

      return { name: tableName, schema, count: count.count, data };
    });

    return NextResponse.json({ dbInfo: schemaAndData });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching DB info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
