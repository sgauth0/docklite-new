
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userSession = await requireAuth();
    const { searchParams } = new URL(request.url);
    const dir = searchParams.get('path') || '/var/www/sites';

    const resolvedPath = path.resolve(dir);

    // Security check: Ensure the path is within /var/www/sites
    if (!resolvedPath.startsWith('/var/www/sites')) {
      return NextResponse.json({ error: 'Forbidden: Access outside allowed directory' }, { status: 403 });
    }

    // For non-admin users, restrict access to their own user directory only
    if (!userSession.isAdmin) {
      const user = getUserById(userSession.userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const userPath = `/var/www/sites/${user.username}`;

      // User can only access /var/www/sites/{username} and subdirectories
      if (!resolvedPath.startsWith(userPath)) {
        return NextResponse.json({
          error: 'Forbidden: You can only access your own sites'
        }, { status: 403 });
      }
    }

    const files = await fs.readdir(resolvedPath, { withFileTypes: true });

    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
    }));

    return NextResponse.json(fileList);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error reading directory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
