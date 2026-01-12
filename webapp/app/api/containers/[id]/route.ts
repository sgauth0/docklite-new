import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getContainerById, getContainerStats, removeContainer } from '@/lib/docker';
import { deleteSite, getSiteByContainerId, unlinkContainerFromAllFolders } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check if user has access to this container
    const site = getSiteByContainerId(id);
    if (!user.isAdmin && (!site || site.user_id !== user.userId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const container = await getContainerById(id);
    if (!container) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      );
    }

    // Get stats if container is running
    let stats = null;
    if (container.state === 'running') {
      stats = await getContainerStats(id);
    }

    return NextResponse.json({ container, stats });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting container:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Only admins can delete any container
    // Regular users can only delete their own site containers
    const site = getSiteByContainerId(id);
    if (!user.isAdmin) {
      if (site) {
        if (site.user_id !== user.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else {
        const container = await getContainerById(id);
        const labelUserId = container?.labels?.['docklite.user.id'];
        if (!labelUserId || labelUserId !== String(user.userId)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    // Remove the container (force=true to remove even if running)
    await removeContainer(id, true);

    if (site) {
      deleteSite(site.id);
    }
    unlinkContainerFromAllFolders(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting container:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
