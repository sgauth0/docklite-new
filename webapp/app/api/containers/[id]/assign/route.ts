import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import {
  createFolder,
  getFolderById,
  getFoldersByUser,
  getSiteByContainerId,
  getUserById,
  moveContainerToFolder,
  updateSiteUserIdByContainerId,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin', 'super_admin']);
    const containerId = params.id;
    const body = await request.json();
    const targetUserId = Number(body.user_id);

    if (!containerId) {
      return NextResponse.json({ error: 'Container ID is required' }, { status: 400 });
    }

    if (!targetUserId || Number.isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Target user is required' }, { status: 400 });
    }

    const site = getSiteByContainerId(containerId);
    if (!site) {
      return NextResponse.json({ error: 'Container is not a managed site' }, { status: 404 });
    }

    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    updateSiteUserIdByContainerId(containerId, targetUserId);

    let targetFolder = getFoldersByUser(targetUserId).find(folder => folder.name === 'Default') || null;
    if (!targetFolder) {
      targetFolder = createFolder(targetUserId, 'Default');
    }

    const validatedFolder = getFolderById(targetFolder.id);
    if (validatedFolder) {
      moveContainerToFolder(containerId, validatedFolder.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('role')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error assigning container:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
