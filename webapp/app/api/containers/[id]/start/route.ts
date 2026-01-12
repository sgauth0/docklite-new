import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { startContainer } from '@/lib/agent-client';
import { getSiteByContainerId, updateSiteStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
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

    await startContainer(id);

    // Update site status in database
    if (site) {
      updateSiteStatus(site.id, 'running');
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error starting container:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start container' },
      { status: 500 }
    );
  }
}
