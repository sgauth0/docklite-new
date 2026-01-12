import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getContainerStats } from '@/lib/agent-client';
import { getSiteByContainerId } from '@/lib/db';

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

    const stats = await getContainerStats(id);

    if (!stats) {
      return NextResponse.json(
        { error: 'Container not running or stats unavailable' },
        { status: 404 }
      );
    }

    return NextResponse.json({ stats });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting container stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get container stats' },
      { status: 500 }
    );
  }
}
