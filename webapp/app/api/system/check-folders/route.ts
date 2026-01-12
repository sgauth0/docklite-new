import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllUsers } from '@/lib/db';
import { ensureAllUserFolders } from '@/lib/user-helpers';

export const dynamic = 'force-dynamic';

/**
 * System maintenance endpoint to ensure all users have their folders created
 * Admin only
 */
export async function POST() {
  try {
    await requireAdmin();

    // Get all users from database
    const users = getAllUsers();

    // Ensure all users have folders
    await ensureAllUserFolders(users);

    return NextResponse.json({
      success: true,
      message: `Checked ${users.length} users`,
      userCount: users.length,
    });
  } catch (error: any) {
    if (error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error checking user folders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
