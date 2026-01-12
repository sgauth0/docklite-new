import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DEFAULT_BACKUP_PATH = '/var/backups/docklite';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(DEFAULT_BACKUP_PATH, fileName);

    if (!resolvedPath.startsWith(`${DEFAULT_BACKUP_PATH}${path.sep}`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stat = await fs.promises.stat(resolvedPath);
    const stream = fs.createReadStream(resolvedPath);

    return new NextResponse(stream as any, {
      headers: {
        'Content-Disposition': `attachment; filename="${path.basename(resolvedPath)}"`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size.toString()
      }
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Error downloading backup file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
