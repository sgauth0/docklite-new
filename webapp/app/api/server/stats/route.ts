import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import os from 'os';
import docker from '@/lib/docker';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// Helper function to get CPU usage percentage
async function getCpuUsage(): Promise<number> {
  try {
    // Read /proc/stat to calculate CPU usage
    const stat1 = await fs.readFile('/proc/stat', 'utf-8');
    const cpuLine1 = stat1.split('\n')[0];
    const values1 = cpuLine1.split(/\s+/).slice(1).map(Number);
    const idle1 = values1[3];
    const total1 = values1.reduce((a, b) => a + b, 0);

    // Wait 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    const stat2 = await fs.readFile('/proc/stat', 'utf-8');
    const cpuLine2 = stat2.split('\n')[0];
    const values2 = cpuLine2.split(/\s+/).slice(1).map(Number);
    const idle2 = values2[3];
    const total2 = values2.reduce((a, b) => a + b, 0);

    const idleDelta = idle2 - idle1;
    const totalDelta = total2 - total1;
    const usage = 100 - (100 * idleDelta / totalDelta);

    return Math.round(usage * 10) / 10;
  } catch (error) {
    // Fallback: calculate from load average
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    return Math.min(Math.round((loadAvg / cpuCount) * 100 * 10) / 10, 100);
  }
}

// Helper function to get disk usage
async function getDiskUsage(): Promise<{ total: number; used: number; free: number; percentage: number }> {
  try {
    const { stdout } = await execAsync('df -B1 / | tail -1');
    const parts = stdout.trim().split(/\s+/);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    const free = parseInt(parts[3]);
    const percentage = Math.round((used / total) * 100);

    return { total, used, free, percentage };
  } catch (error) {
    return { total: 0, used: 0, free: 0, percentage: 0 };
  }
}

// Helper function to get network stats
async function getNetworkStats(): Promise<{ received: number; transmitted: number }> {
  try {
    const netDev = await fs.readFile('/proc/net/dev', 'utf-8');
    const lines = netDev.split('\n').slice(2); // Skip header lines

    let totalReceived = 0;
    let totalTransmitted = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.trim().split(/\s+/);
      const iface = parts[0].replace(':', '');

      // Skip loopback
      if (iface === 'lo') continue;

      totalReceived += parseInt(parts[1]) || 0;
      totalTransmitted += parseInt(parts[9]) || 0;
    }

    return { received: totalReceived, transmitted: totalTransmitted };
  } catch (error) {
    return { received: 0, transmitted: 0 };
  }
}

export async function GET() {
  try {
    await requireAuth();

    // Get Docker info
    const dockerInfo = await docker.info();
    const dockerVersion = await docker.version();

    // Get system info
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const cpus = os.cpus().length;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const uptime = os.uptime();

    // Get real-time metrics
    const [cpuUsage, diskUsage, networkStats] = await Promise.all([
      getCpuUsage(),
      getDiskUsage(),
      getNetworkStats(),
    ]);

    return NextResponse.json({
      hostname,
      platform,
      arch,
      cpus,
      totalMemory,
      freeMemory,
      uptime,
      dockerVersion: dockerVersion.Version,
      containerCount: dockerInfo.ContainersRunning || 0,
      imageCount: dockerInfo.Images || 0,
      // Real-time metrics
      cpuUsage,
      diskUsage,
      networkStats,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting server stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get server stats' },
      { status: 500 }
    );
  }
}
