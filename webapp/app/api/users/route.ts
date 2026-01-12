import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAuth, canManageUser } from '@/lib/auth';
import { createUser, deleteUserWithTransfer, getUserById } from '@/lib/db';
import { ensureUserFolder } from '@/lib/user-helpers';

export const dynamic = 'force-dynamic';
const MIN_PASSWORD_LENGTH = 10;

// Get all users (admin only)
export async function GET() {
  try {
    const user = await requireAuth();

    const db = require('@/lib/db').default;
    const users = db.prepare(`
      SELECT id, username, is_admin, role, is_super_admin, managed_by, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    return NextResponse.json({ users });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const { username, password, isAdmin } = await request.json();

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const isSuperAdmin = currentUser.role === 'super_admin';
    const shouldCreateAdmin = isSuperAdmin && isAdmin;
    const newUser = createUser(
      username,
      password,
      shouldCreateAdmin,
      shouldCreateAdmin ? 'admin' : 'user',
      isSuperAdmin ? null : currentUser.userId
    );

    // Create user's home folder in /var/www/sites/{username}
    try {
      const userPath = await ensureUserFolder(username);
      console.log(`✓ Created folder for user ${username}: ${userPath}`);
    } catch (folderError) {
      console.error(`⚠️ Failed to create folder for user ${username}:`, folderError);
      // Don't fail user creation if folder creation fails - we can fix it later
    }

    return NextResponse.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        isAdmin: newUser.is_admin === 1,
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users?id=1 - Delete a user (admin only, with role rules)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    if (!currentUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const targetUserId = Number(idParam);
    if (!Number.isFinite(targetUserId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (targetUserId === currentUser.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (currentUser.role !== 'super_admin') {
      const canManage = await canManageUser(currentUser.userId, targetUserId);
      if (!canManage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const transferTo = targetUser.managed_by ?? currentUser.userId;
    deleteUserWithTransfer(targetUserId, transferTo);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
