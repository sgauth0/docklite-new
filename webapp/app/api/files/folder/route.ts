import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    const userSession = await requireAuth();
    const user = getUserById(userSession.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { path: folderPath } = await request.json();

    if (!folderPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(folderPath);

    // Security check: Ensure the path is within /var/www/sites
    if (!resolvedPath.startsWith('/var/www/sites')) {
      return NextResponse.json(
        { error: 'Forbidden: Access outside allowed directory' },
        { status: 403 }
      );
    }

    // For non-admin users, restrict to their own directory
    if (!userSession.isAdmin) {
      const userPath = `/var/www/sites/${user.username}`;
      if (!resolvedPath.startsWith(userPath)) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete your own sites' },
          { status: 403 }
        );
      }
    }

    // Use rm -rf to delete the entire directory
    await execAsync(`rm -rf "${resolvedPath}"`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
