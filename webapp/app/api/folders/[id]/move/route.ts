import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFolderById, moveFolderToParent, getFoldersByUser } from '@/lib/db';
import { canNestFolder } from '@/lib/folder-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folderId = parseInt(params.id);
    if (isNaN(folderId)) {
      return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
    }

    // Verify folder exists and user owns it
    const folder = getFolderById(folderId);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.user_id !== session.user.userId && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent moving the Default folder
    if (folder.name === 'Default') {
      return NextResponse.json(
        { error: 'Cannot move the Default folder' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { newParentId } = body;

    const parentId = newParentId === null ? null : parseInt(newParentId);
    if (parentId !== null && isNaN(parentId)) {
      return NextResponse.json({ error: 'Invalid parent folder ID' }, { status: 400 });
    }

    // Validate nesting
    const allFolders = getFoldersByUser(session.user.userId);
    const validation = canNestFolder(folderId, parentId, allFolders);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Move the folder
    moveFolderToParent(folderId, parentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error moving folder:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to move folder' },
      { status: 500 }
    );
  }
}
