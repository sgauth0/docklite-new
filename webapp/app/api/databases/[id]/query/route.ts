import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDatabase, runPsql } from '../db-utils';

export const dynamic = 'force-dynamic';

function normalizeSql(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
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

    const { username, password, sql } = await request.json();
    if (!username || !password || !sql) {
      return NextResponse.json({ error: 'Username, password, and SQL are required' }, { status: 400 });
    }

    const database = await requireAdminDatabase(databaseId);
    if (!database.container_id) {
      return NextResponse.json({ error: 'Database container not found' }, { status: 404 });
    }

    const normalized = normalizeSql(sql);
    const isSelectable = /^(select|with)\b/i.test(normalized);

    if (isSelectable) {
      const wrappedSql = `
        SELECT coalesce(json_agg(t), '[]'::json)
        FROM (${normalized}) t;
      `;
      const rowsJson = await runPsql({
        containerId: database.container_id,
        dbName: database.name,
        username,
        password,
        sql: wrappedSql,
        format: 'json',
      });
      const rows = JSON.parse(rowsJson || '[]') as Record<string, any>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return NextResponse.json({ type: 'select', rows, columns });
    }

    const output = await runPsql({
      containerId: database.container_id,
      dbName: database.name,
      username,
      password,
      sql: normalized,
      format: 'raw',
    });

    return NextResponse.json({ type: 'command', output: output || 'Query executed.' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }
    console.error('Error executing query:', error);
    return NextResponse.json({ error: 'Failed to execute query' }, { status: 500 });
  }
}
