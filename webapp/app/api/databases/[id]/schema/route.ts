import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDatabase, runPsql } from '../db-utils';

export const dynamic = 'force-dynamic';

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

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

    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const database = await requireAdminDatabase(databaseId);
    if (!database.container_id) {
      return NextResponse.json({ error: 'Database container not found' }, { status: 404 });
    }

    const tablesSql = `
      SELECT coalesce(json_agg(t), '[]'::json)
      FROM (
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      ) t;
    `;

    const columnsSql = `
      SELECT coalesce(json_agg(t), '[]'::json)
      FROM (
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      ) t;
    `;

    const tablesJson = await runPsql({
      containerId: database.container_id,
      dbName: database.name,
      username,
      password,
      sql: tablesSql,
      format: 'json',
    });

    const columnsJson = await runPsql({
      containerId: database.container_id,
      dbName: database.name,
      username,
      password,
      sql: columnsSql,
      format: 'json',
    });

    const tables = JSON.parse(tablesJson || '[]') as Array<{ table_name: string }>;
    const columns = JSON.parse(columnsJson || '[]') as ColumnRow[];

    const columnsByTable = new Map<string, ColumnRow[]>();
    columns.forEach((col) => {
      if (!columnsByTable.has(col.table_name)) {
        columnsByTable.set(col.table_name, []);
      }
      columnsByTable.get(col.table_name)?.push(col);
    });

    const responseTables = tables.map((table) => ({
      name: table.table_name,
      columns: (columnsByTable.get(table.table_name) || []).map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
      })),
    }));

    return NextResponse.json({ tables: responseTables });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }
    console.error('Error fetching schema:', error);
    return NextResponse.json({ error: 'Failed to fetch schema' }, { status: 500 });
  }
}
