import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAuth, getSession } from '@/lib/auth';
import { clearUserSessions, getUserById, updateUserPassword, verifyPassword } from '@/lib/db';

export const dynamic = 'force-dynamic';
const MIN_PASSWORD_LENGTH = 10;

export async function POST(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (userId) {
      await requireAdmin();
      const targetUserId = Number(userId);
      if (!Number.isFinite(targetUserId)) {
        return NextResponse.json(
          { error: 'Invalid user ID' },
          { status: 400 }
        );
      }
      updateUserPassword(targetUserId, newPassword);
      clearUserSessions(targetUserId);
      return NextResponse.json({ success: true });
    }

    const user = await requireAuth();
    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      );
    }

    const dbUser = getUserById(user.userId);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!verifyPassword(dbUser, currentPassword)) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    updateUserPassword(user.userId, newPassword);
    clearUserSessions(user.userId);

    // Refresh current session to keep the user logged in with updated data
    const session = await getSession();
    session.user = {
      userId: user.userId,
      username: user.username,
      isAdmin: user.isAdmin,
      role: user.role,
    };
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    console.error('Error changing user password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to change password' },
      { status: 500 }
    );
  }
}
