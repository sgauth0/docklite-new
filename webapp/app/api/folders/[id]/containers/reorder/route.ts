import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFolderById, reorderContainerInFolder } from '@/lib/db';

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

    const body = await request.json();
    const { containerId, newPosition } = body;

    if (!containerId || typeof newPosition !== 'number') {
      return NextResponse.json(
        { error: 'containerId and newPosition are required' },
        { status: 400 }
      );
    }

    // Reorder the container
    reorderContainerInFolder(folderId, containerId, newPosition);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error reordering container:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder container' },
      { status: 500 }
    );
  }
}
