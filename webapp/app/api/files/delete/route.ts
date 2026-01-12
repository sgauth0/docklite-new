import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    const userSession = await requireAuth();
    if (!userSession.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = getUserById(userSession.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { path: targetPath } = await request.json();
    if (!targetPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(targetPath);

    if (!resolvedPath.startsWith('/var/www/sites')) {
      return NextResponse.json({ error: 'Forbidden: Access outside allowed directory' }, { status: 403 });
    }

    const stats = await fs.stat(resolvedPath).catch(() => null);
    if (!stats) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    await fs.rm(resolvedPath, { recursive: true, force: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
