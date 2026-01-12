import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import docker from '@/lib/docker';

export const dynamic = 'force-dynamic';

const TRAEFIK_NAME = process.env.TRAEFIK_CONTAINER_NAME || 'docklite_traefik';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const { domain } = await request.json();

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Find traefik container
    const containers = await docker.listContainers({ all: true, filters: { name: [TRAEFIK_NAME] } });
    if (!containers || containers.length === 0) {
      return NextResponse.json({ error: 'Traefik container not found' }, { status: 404 });
    }

    const container = docker.getContainer(containers[0].Id);

    // Soft restart traefik to force reload and ACME reconciliation
    try {
      await container.restart();
    } catch (err: any) {
      console.error('Failed to restart Traefik:', err);
      return NextResponse.json({ error: 'Failed to restart Traefik' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Repair triggered for ${domain}` });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error repairing SSL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
