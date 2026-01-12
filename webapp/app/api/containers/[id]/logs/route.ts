import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getContainerLogs } from '@/lib/agent-client';
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

    const { searchParams } = new URL(request.url);
    const tail = parseInt(searchParams.get('tail') || '100', 10);

    const logs = await getContainerLogs(id, tail);

    return NextResponse.json({ logs });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting container logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get container logs' },
      { status: 500 }
    );
  }
}
