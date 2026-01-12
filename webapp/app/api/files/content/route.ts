
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

function checkUserPathAccess(resolvedPath: string, username: string, isAdmin: boolean): boolean {
  // Security check: Ensure the path is within /var/www/sites
  if (!resolvedPath.startsWith('/var/www/sites')) {
    return false;
  }

  // Admins can access all of /var/www/sites
  if (isAdmin) {
    return true;
  }

  // Non-admin users can only access /var/www/sites/{username}
  const userPath = `/var/www/sites/${username}`;
  return resolvedPath.startsWith(userPath);
}

export async function GET(request: Request) {
  try {
    const userSession = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(filePath);

    // Get user info for permission check
    const user = getUserById(userSession.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access to this path
    if (!checkUserPathAccess(resolvedPath, user.username, userSession.isAdmin)) {
      return NextResponse.json({
        error: userSession.isAdmin
          ? 'Forbidden: Access outside allowed directory'
          : 'Forbidden: You can only access your own sites'
      }, { status: 403 });
    }

    const content = await fs.readFile(resolvedPath, 'utf-8');

    return NextResponse.json({ content });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error reading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userSession = await requireAuth();
    const { filePath, content } = await request.json();

    if (!filePath || content === undefined) {
      return NextResponse.json({ error: 'File path and content are required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(filePath);

    // Get user info for permission check
    const user = getUserById(userSession.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access to this path
    if (!checkUserPathAccess(resolvedPath, user.username, userSession.isAdmin)) {
      return NextResponse.json({
        error: userSession.isAdmin
          ? 'Forbidden: Access outside allowed directory'
          : 'Forbidden: You can only access your own sites'
      }, { status: 403 });
    }

    await fs.writeFile(resolvedPath, content, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error writing file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
