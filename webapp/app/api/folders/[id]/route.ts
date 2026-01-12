import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getFolderById,
  deleteFolder,
} from '@/lib/db';

// DELETE /api/folders/:id - Delete folder
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

    // Check folder exists and belongs to user
    const folder = getFolderById(folderId);

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Only owner can delete (admins can't delete other users' folders for safety)
    if (folder.user_id !== user.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this folder' },
        { status: 403 }
      );
    }

    // Prevent deleting "Default" folder
    if (folder.name === 'Default') {
      return NextResponse.json(
        { error: 'Cannot delete the Default folder' },
        { status: 400 }
      );
    }

    deleteFolder(folderId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete folder' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

// GET /api/folders/:id - Get single folder details
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

    // Only owner can view folder details
    if (folder.user_id !== user.userId && !user.isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to view this folder' },
        { status: 403 }
      );
    }

    return NextResponse.json({ folder });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch folder' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
