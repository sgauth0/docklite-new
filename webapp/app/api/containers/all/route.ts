import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listContainers } from '@/lib/agent-client';
import { getUntrackedContainerIds } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();

    // List ALL containers (not just DockLite-managed ones)
    const containers = await listContainers(false);
    const untrackedSet = new Set(getUntrackedContainerIds());
    const withTracking = containers.map(container => ({
      ...container,
      tracked: !untrackedSet.has(container.id),
    }));

    return NextResponse.json({ containers: withTracking });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing all containers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
