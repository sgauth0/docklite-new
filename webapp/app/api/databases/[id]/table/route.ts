import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDatabase, runPsql } from '../db-utils';

export const dynamic = 'force-dynamic';

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const databaseId = parseInt(id, 10);
    if (isNaN(databaseId)) {
      return NextResponse.json({ error: 'Invalid database ID' }, { status: 400 });
    }

    const { username, password, table } = await request.json();
    if (!username || !password || !table) {
      return NextResponse.json({ error: 'Username, password, and table are required' }, { status: 400 });
    }

    if (!IDENTIFIER_PATTERN.test(table)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    const database = await requireAdminDatabase(databaseId);
    if (!database.container_id) {
      return NextResponse.json({ error: 'Database container not found' }, { status: 404 });
    }

    const columnsSql = `
      SELECT coalesce(json_agg(t), '[]'::json)
      FROM (
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}'
        ORDER BY ordinal_position
      ) t;
    `;

    const rowsSql = `
      SELECT coalesce(json_agg(t), '[]'::json)
      FROM (
        SELECT * FROM "${table}" LIMIT 10
      ) t;
    `;

    const columnsJson = await runPsql({
      containerId: database.container_id,
      dbName: database.name,
      username,
      password,
      sql: columnsSql,
      format: 'json',
    });

    const rowsJson = await runPsql({
      containerId: database.container_id,
      dbName: database.name,
      username,
      password,
      sql: rowsSql,
      format: 'json',
    });

    const columns = JSON.parse(columnsJson || '[]') as Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>;
    const rows = JSON.parse(rowsJson || '[]') as Record<string, any>[];

    return NextResponse.json({
      columns: columns.map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
      })),
      rows,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }
    console.error('Error fetching table:', error);
    return NextResponse.json({ error: 'Failed to fetch table data' }, { status: 500 });
  }
}
