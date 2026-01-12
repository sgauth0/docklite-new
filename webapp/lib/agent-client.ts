import { ContainerInfo, ContainerStats } from '@/types';

// Agent configuration
const AGENT_URL =
  process.env.AGENT_URL ||
  process.env.DOCKLITE_AGENT_URL ||
  'http://localhost:9000';
const AGENT_TOKEN =
  process.env.AGENT_TOKEN ||
  process.env.DOCKLITE_AGENT_TOKEN ||
  process.env.DOCKLITE_TOKEN ||
  '';

interface AgentError {
  error: string;
}

class AgentClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'AgentClientError';
  }
}

/**
 * Make a request to the agent API with error handling
 */
async function agentRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${AGENT_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(AGENT_TOKEN ? { Authorization: `Bearer ${AGENT_TOKEN}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `Agent request failed: ${response.status}`;
      try {
        const errorData: AgentError = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      throw new AgentClientError(errorMessage, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AgentClientError) {
      throw error;
    }
    console.error(`Agent request error (${endpoint}):`, error);
    throw new AgentClientError(
      `Failed to connect to agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// CONTAINER LISTING
// ============================================

export async function listContainers(managedOnly: boolean = true): Promise<ContainerInfo[]> {
  try {
    const response = await agentRequest<{ containers: any[] }>('/api/containers');

    const containers = response.containers.map(container => ({
      id: container.id,
      name: container.name,
      status: container.status,
      state: container.state,
      uptime: container.uptime || '-',
      image: container.image,
      ports: container.ports || '',
      labels: container.labels || {},
    }));

    if (!managedOnly) {
      return containers;
    }

    return containers.filter(
      (container) => container.labels?.['docklite.managed'] === 'true'
    );
  } catch (error) {
    console.error('Error listing containers from agent:', error);
    throw new Error('Failed to list containers');
  }
}

// ============================================
// CONTAINER DETAILS
// ============================================

export async function getContainerById(id: string): Promise<ContainerInfo | null> {
  try {
    const response = await agentRequest<{ container: any }>(`/api/containers/${id}`);

    if (!response.container) {
      return null;
    }

    const container = response.container;
    return {
      id: container.id,
      name: container.name,
      status: container.status,
      state: container.state,
      uptime: container.uptime || '-',
      image: container.image,
      ports: container.ports || '',
      labels: container.labels || {},
    };
  } catch (error) {
    if (error instanceof AgentClientError && error.statusCode === 404) {
      return null;
    }
    console.error(`Error getting container ${id} from agent:`, error);
    return null;
  }
}

// ============================================
// CONTAINER CONTROL
// ============================================

export async function startContainer(id: string): Promise<void> {
  try {
    await agentRequest(`/api/containers/${id}/start`, {
      method: 'POST',
    });
  } catch (error: any) {
    console.error(`Error starting container ${id}:`, error);
    throw new Error(`Failed to start container: ${error.message}`);
  }
}

export async function stopContainer(id: string): Promise<void> {
  try {
    await agentRequest(`/api/containers/${id}/stop`, {
      method: 'POST',
    });
  } catch (error: any) {
    console.error(`Error stopping container ${id}:`, error);
    throw new Error(`Failed to stop container: ${error.message}`);
  }
}

export async function restartContainer(id: string): Promise<void> {
  try {
    await agentRequest(`/api/containers/${id}/restart`, {
      method: 'POST',
    });
  } catch (error: any) {
    console.error(`Error restarting container ${id}:`, error);
    throw new Error(`Failed to restart container: ${error.message}`);
  }
}

export async function removeContainer(id: string, force: boolean = false): Promise<void> {
  try {
    await agentRequest(`/api/containers/${id}`, {
      method: 'DELETE',
    });
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
    const response = await agentRequest<{ logs: string }>(
      `/api/containers/${id}/logs?tail=${tail}`
    );
    return response.logs || '';
  } catch (error) {
    console.error(`Error getting logs for container ${id}:`, error);
    throw new Error('Failed to get container logs');
  }
}

// ============================================
// CONTAINER STATS
// ============================================

export async function getContainerStats(id: string): Promise<ContainerStats | null> {
  try {
    const response = await agentRequest<{ stats: any }>(`/api/containers/${id}/stats`);

    if (!response.stats) {
      return null;
    }

    const stats = response.stats;
    return {
      cpu: stats.cpuUsage || 0,
      memory: {
        used: stats.memoryUsage || 0,
        total: stats.memoryLimit || 0,
        percentage: stats.memoryPct || 0,
      },
    };
  } catch (error) {
    if (error instanceof AgentClientError && error.statusCode === 404) {
      return null;
    }
    console.error(`Error getting stats for container ${id}:`, error);
    return null;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkAgentHealth(): Promise<{ status: string }> {
  try {
    return await agentRequest<{ status: string }>('/api/health');
  } catch (error) {
    throw new Error('Agent health check failed');
  }
}

// ============================================
// SERVER STATUS
// ============================================

export async function getServerStatus(): Promise<any> {
  try {
    return await agentRequest('/api/status');
  } catch (error) {
    console.error('Error getting server status from agent:', error);
    throw new Error('Failed to get server status');
  }
}

// ============================================
// SUMMARY
// ============================================

export async function getSummary(): Promise<any> {
  try {
    return await agentRequest('/api/summary');
  } catch (error) {
    console.error('Error getting summary from agent:', error);
    throw new Error('Failed to get summary');
  }
}
