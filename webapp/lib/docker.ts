import Docker from 'dockerode';
import { ContainerInfo, ContainerStats } from '@/types';

// Initialize dockerode client
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock' });

// ============================================
// CONTAINER LISTING
// ============================================

export async function listContainers(managedOnly: boolean = true): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: managedOnly
        ? {
            label: ['docklite.managed=true'],
          }
        : undefined,
    });

    return containers.map(container => {
      const created = new Date(container.Created * 1000);
      const now = new Date();
      const uptime = formatUptime(now.getTime() - created.getTime());

      return {
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') || 'unknown',
        status: container.Status,
        state: container.State,
        uptime: container.State === 'running' ? uptime : '-',
        image: container.Image,
        ports: formatPorts(container.Ports),
        labels: container.Labels,
      };
    });
  } catch (error) {
    console.error('Error listing containers:', error);
    throw new Error('Failed to list containers');
  }
}

// ============================================
// CONTAINER DETAILS
// ============================================

export async function getContainerById(id: string): Promise<ContainerInfo | null> {
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();

    const created = new Date(info.Created);
    const now = new Date();
    const uptime = info.State.Running ? formatUptime(now.getTime() - created.getTime()) : '-';

    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ''),
      status: info.State.Status,
      state: info.State.Running ? 'running' : 'stopped',
      uptime,
      image: info.Config.Image,
      ports: formatPortsFromInspect(info.NetworkSettings.Ports),
      labels: info.Config.Labels || {},
    };
  } catch (error) {
    console.error(`Error getting container ${id}:`, error);
    return null;
  }
}

// ============================================
// CONTAINER CONTROL
// ============================================

export async function startContainer(id: string): Promise<void> {
  try {
    const container = docker.getContainer(id);
    await container.start();
  } catch (error: any) {
    if (error.statusCode === 304) {
      // Container already started - not an error
      return;
    }
    console.error(`Error starting container ${id}:`, error);
    throw new Error(`Failed to start container: ${error.message}`);
  }
}

export async function stopContainer(id: string): Promise<void> {
  try {
    const container = docker.getContainer(id);
    await container.stop();
  } catch (error: any) {
    if (error.statusCode === 304) {
      // Container already stopped - not an error
      return;
    }
    console.error(`Error stopping container ${id}:`, error);
    throw new Error(`Failed to stop container: ${error.message}`);
  }
}

export async function restartContainer(id: string): Promise<void> {
  try {
    const container = docker.getContainer(id);
    await container.restart();
  } catch (error: any) {
    console.error(`Error restarting container ${id}:`, error);
    throw new Error(`Failed to restart container: ${error.message}`);
  }
}

export async function removeContainer(id: string, force: boolean = false): Promise<void> {
  try {
    const container = docker.getContainer(id);
    await container.remove({ force });
  } catch (error: any) {
    console.error(`Error removing container ${id}:`, error);
    throw new Error(`Failed to remove container: ${error.message}`);
  }
}

// ============================================
// CONTAINER LOGS
// ============================================

export async function getContainerLogs(id: string, tail: number = 100): Promise<string> {
  try {
    const container = docker.getContainer(id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    // Convert buffer to string and clean up
    return logs.toString('utf8')
      .split('\n')
      .map(line => line.replace(/[\x00-\x08]/g, '')) // Remove control characters
      .join('\n');
  } catch (error: any) {
    console.error(`Error getting logs for container ${id}:`, error);
    throw new Error(`Failed to get container logs: ${error.message}`);
  }
}

// ============================================
// CONTAINER STATS
// ============================================

export async function getContainerStats(id: string): Promise<ContainerStats | null> {
  try {
    const container = docker.getContainer(id);
    const stats = await container.stats({ stream: false });

    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    // Calculate memory usage
    const memoryUsed = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;
    const memoryPercent = memoryLimit > 0 ? (memoryUsed / memoryLimit) * 100 : 0;

    return {
      cpu: Math.round(cpuPercent * 100) / 100,
      memory: {
        used: memoryUsed,
        total: memoryLimit,
        percentage: Math.round(memoryPercent * 100) / 100,
      },
    };
  } catch (error: any) {
    console.error(`Error getting stats for container ${id}:`, error);
    return null;
  }
}

// ============================================
// CREATE CONTAINER
// ============================================

export async function createContainer(config: Docker.ContainerCreateOptions): Promise<string> {
  const networkMode = config.HostConfig?.NetworkMode;
  if (networkMode && typeof networkMode === 'string') {
    await ensureNetworkExists(networkMode);
  }

  try {
    const container = await docker.createContainer(config);
    await container.start();
    return container.id;
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.includes('network') && message.includes('not found') && networkMode) {
      await ensureNetworkExists(networkMode, true);
      const container = await docker.createContainer(config);
      await container.start();
      return container.id;
    }
    console.error('Error creating container:', error);
    throw new Error(`Failed to create container: ${error.message}`);
  }
}

async function ensureNetworkExists(name: string, forceCreate: boolean = false): Promise<void> {
  try {
    const networks = await docker.listNetworks({ filters: { name: [name] } });
    if (!forceCreate && networks.some(network => network.Name === name)) {
      return;
    }
    if (forceCreate || networks.length === 0) {
      await docker.createNetwork({
        Name: name,
        Driver: 'bridge',
      });
      console.log(`✓ Created Docker network: ${name}`);
    }
  } catch (error) {
    console.error(`Error ensuring network ${name}:`, error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatPorts(ports: Docker.Port[]): string {
  if (!ports || ports.length === 0) return '-';

  return ports
    .filter(p => p.PublicPort)
    .map(p => `${p.PublicPort}→${p.PrivatePort}`)
    .join(', ') || '-';
}

// Type definition for the port mapping object from container inspect
type PortMap = { [containerPort: string]: { HostIp: string; HostPort: string }[] | null };

function formatPortsFromInspect(ports: PortMap): string {
  if (!ports) return '-';

  const portMappings: string[] = [];
  for (const [containerPort, hostPorts] of Object.entries(ports)) {
    if (Array.isArray(hostPorts) && hostPorts.length > 0) {
      const hostPort = hostPorts[0].HostPort;
      const cleanPort = containerPort.replace('/tcp', '').replace('/udp', '');
      portMappings.push(`${hostPort}→${cleanPort}`);
    }
  }

  return portMappings.length > 0 ? portMappings.join(', ') : '-';
}

// Pull an image if it doesn't exist
export async function pullImage(imageName: string): Promise<void> {
  try {
    // Check if image exists
    try {
      await docker.getImage(imageName).inspect();
      return; // Image already exists
    } catch {
      // Image doesn't exist, pull it
      console.log(`Pulling image: ${imageName}`);
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err: any, stream: any) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err: any) => {
            if (err) return reject(err);
            resolve(null);
          });
        });
      });
      console.log(`Image pulled: ${imageName}`);
    }
  } catch (error: any) {
    console.error(`Error pulling image ${imageName}:`, error);
    throw new Error(`Failed to pull image: ${error.message}`);
  }
}

export default docker;
