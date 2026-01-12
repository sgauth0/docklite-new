import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listContainers } from '@/lib/docker';

export const dynamic = 'force-dynamic';

const DEFAULT_NODE_PORT = 3000;

function getUsedNodePorts(containers: Array<{ labels?: Record<string, string> }>): Set<number> {
  const used = new Set<number>();
  for (const container of containers) {
    const labels = container.labels || {};
    if (labels['docklite.type'] !== 'node') continue;
    for (const [key, value] of Object.entries(labels)) {
      if (key.includes('loadbalancer.server.port')) {
        const port = Number(value);
        if (!Number.isNaN(port)) {
          used.add(port);
        }
      }
    }
  }
  return used;
}

function findNextPort(used: Set<number>, start = DEFAULT_NODE_PORT, max = 3999): number {
  for (let port = start; port <= max; port += 1) {
    if (!used.has(port)) return port;
  }
  return start;
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type !== 'node') {
      return NextResponse.json({ port: DEFAULT_NODE_PORT });
    }

    const containers = await listContainers(true);
    const usedPorts = getUsedNodePorts(containers);
    const port = findNextPort(usedPorts);

    return NextResponse.json({ port });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error suggesting port:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
