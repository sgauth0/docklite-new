import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const DEFAULT_BACKUP_PATH = '/var/backups/docklite';

export async function GET() {
  try {
    await requireAdmin();

    const entries = await fs.readdir(DEFAULT_BACKUP_PATH, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fullPath = path.join(DEFAULT_BACKUP_PATH, entry.name);
          const stat = await fs.stat(fullPath);
          return {
            name: entry.name,
            size: stat.size,
            modified_at: stat.mtime.toISOString()
          };
        })
    );

    files.sort((a, b) => (a.modified_at < b.modified_at ? 1 : -1));

    return NextResponse.json({ path: DEFAULT_BACKUP_PATH, files });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ path: DEFAULT_BACKUP_PATH, files: [] });
    }
    console.error('Error listing local backups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = request.nextUrl;
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(DEFAULT_BACKUP_PATH, fileName);

    if (!resolvedPath.startsWith(`${DEFAULT_BACKUP_PATH}${path.sep}`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await fs.unlink(resolvedPath);
    return NextResponse.json({ message: 'Backup file deleted successfully' });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Error deleting local backup file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
