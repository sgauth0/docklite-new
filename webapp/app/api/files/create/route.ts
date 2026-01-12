import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const userSession = await requireAuth();
    const { basePath, name, type } = await request.json();

    if (!basePath || !name || !type) {
      return NextResponse.json({ error: 'Base path, name, and type are required' }, { status: 400 });
    }

    if (name.includes('/') || name.includes('\\')) {
      return NextResponse.json({ error: 'Name cannot include path separators' }, { status: 400 });
    }

    if (type !== 'file' && type !== 'folder') {
      return NextResponse.json({ error: 'Type must be file or folder' }, { status: 400 });
    }

    const resolvedBase = path.resolve(basePath);

    // Security check: Ensure the base path is within /var/www/sites
    if (!resolvedBase.startsWith('/var/www/sites')) {
      return NextResponse.json({ error: 'Forbidden: Access outside allowed directory' }, { status: 403 });
    }

    const user = getUserById(userSession.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!userSession.isAdmin) {
      const userPath = `/var/www/sites/${user.username}`;
      if (!resolvedBase.startsWith(userPath)) {
        return NextResponse.json({ error: 'Forbidden: You can only access your own sites' }, { status: 403 });
      }
    }

    const targetPath = path.resolve(path.join(resolvedBase, name));

    if (!targetPath.startsWith(resolvedBase)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (type === 'folder') {
      await fs.mkdir(targetPath);
    } else {
      await fs.writeFile(targetPath, '', { flag: 'wx' });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      return NextResponse.json({ error: 'Already exists' }, { status: 409 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating file or folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
