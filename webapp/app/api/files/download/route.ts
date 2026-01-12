
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(filePath);

    // Security check: Ensure the path is within the intended directory
    if (!resolvedPath.startsWith('/var/www/sites')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stat = await fs.promises.stat(resolvedPath);
    const stream = fs.createReadStream(resolvedPath);

    return new NextResponse(stream as any, {
      headers: {
        'Content-Disposition': `attachment; filename="${path.basename(resolvedPath)}"`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Error downloading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
