import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getFoldersByUser,
  createFolder,
  deleteFolder,
} from '@/lib/db';

// GET /api/folders - List user's folders
export async function GET() {
  try {
    const user = await requireAuth();
    const folders = getFoldersByUser(user.userId);

    return NextResponse.json({ folders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch folders' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}

// POST /api/folders - Create new folder
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { name, parentFolderId } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    // Validate name (no special chars except spaces, dashes, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return NextResponse.json(
        { error: 'Folder name can only contain letters, numbers, spaces, dashes, and underscores' },
        { status: 400 }
      );
    }

    // Parse optional parentFolderId
    const parentId = parentFolderId ? parseInt(parentFolderId) : undefined;
    if (parentFolderId !== undefined && (isNaN(parentId!) || parentId! <= 0)) {
      return NextResponse.json(
        { error: 'Invalid parent folder ID' },
        { status: 400 }
      );
    }

    const folder = createFolder(user.userId, name.trim(), parentId);

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { error: 'A folder with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
