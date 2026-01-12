import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getFolderById,
  linkContainerToFolder,
  unlinkContainerFromFolder,
  getContainersByFolder,
  moveContainerToFolder,
} from '@/lib/db';

// GET /api/folders/:id/containers - List containers in folder
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const folderId = parseInt(params.id);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }

    const folder = getFolderById(folderId);

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Only owner can view (or admin)
    if (folder.user_id !== user.userId && !user.isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to view this folder' },
        { status: 403 }
      );
    }

    const containerIds = getContainersByFolder(folderId);

    return NextResponse.json({ containerIds });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch containers' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

// POST /api/folders/:id/containers - Add container to folder
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const folderId = parseInt(params.id);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { containerId } = body;

    if (!containerId || typeof containerId !== 'string') {
      return NextResponse.json(
        { error: 'Container ID is required' },
        { status: 400 }
      );
    }

    const folder = getFolderById(folderId);

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Only owner can modify folder
    if (folder.user_id !== user.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this folder' },
        { status: 403 }
      );
    }

    // Move container to this folder (removes from any other folder first)
    moveContainerToFolder(containerId, folderId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to add container to folder' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

// DELETE /api/folders/:id/containers/:containerId - Remove container from folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const folderId = parseInt(params.id);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }

    // Get containerId from query params
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('containerId');

    if (!containerId) {
      return NextResponse.json(
        { error: 'Container ID is required' },
        { status: 400 }
      );
    }

    const folder = getFolderById(folderId);

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Only owner can modify folder
    if (folder.user_id !== user.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this folder' },
        { status: 403 }
      );
    }

    unlinkContainerFromFolder(folderId, containerId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to remove container from folder' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
