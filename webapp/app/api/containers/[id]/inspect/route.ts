import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import docker from '@/lib/docker';
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

    const container = docker.getContainer(id);
    const inspection = await container.inspect();

    // Extract useful information
    const info = {
      id: inspection.Id,
      name: inspection.Name.replace(/^\//, ''),
      image: inspection.Config.Image,
      created: inspection.Created,
      state: inspection.State,
      env: inspection.Config.Env || [],
      labels: inspection.Config.Labels || {},
      mounts: inspection.Mounts || [],
      networkSettings: {
        networks: inspection.NetworkSettings.Networks || {},
        ports: inspection.NetworkSettings.Ports || {},
        ipAddress: inspection.NetworkSettings.IPAddress,
        gateway: inspection.NetworkSettings.Gateway,
      },
      restartPolicy: inspection.HostConfig.RestartPolicy,
      resources: {
        memory: inspection.HostConfig.Memory,
        memorySwap: inspection.HostConfig.MemorySwap,
        cpuShares: inspection.HostConfig.CpuShares,
        cpuQuota: inspection.HostConfig.CpuQuota,
      },
    };

    return NextResponse.json({ container: info });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error inspecting container:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to inspect container' },
      { status: 500 }
    );
  }
}
