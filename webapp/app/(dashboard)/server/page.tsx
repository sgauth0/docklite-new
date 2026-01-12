'use client';

import { useEffect, useState } from 'react';

export default function ServerPage() {
  const [serverInfo, setServerInfo] = useState({
    hostname: '',
    platform: '',
    arch: '',
    cpus: 0,
    totalMemory: 0,
    freeMemory: 0,
    uptime: 0,
    dockerVersion: '',
    containerCount: 0,
    imageCount: 0,
    cpuUsage: 0,
    diskUsage: { total: 0, used: 0, free: 0, percentage: 0 },
    networkStats: { received: 0, transmitted: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const res = await fetch('/api/server/stats');
        if (!res.ok) throw new Error('Failed to fetch server stats');
        const data = await res.json();
        setServerInfo({
          hostname: data.hostname,
          platform: data.platform,
          arch: data.arch,
          cpus: data.cpus,
          totalMemory: Math.round(data.totalMemory / (1024 * 1024 * 1024)), // Convert to GB
          freeMemory: Math.round(data.freeMemory / (1024 * 1024 * 1024)), // Convert to GB
          uptime: data.uptime,
          dockerVersion: data.dockerVersion,
          containerCount: data.containerCount,
          imageCount: data.imageCount,
          cpuUsage: data.cpuUsage || 0,
          diskUsage: data.diskUsage || { total: 0, used: 0, free: 0, percentage: 0 },
          networkStats: data.networkStats || { received: 0, transmitted: 0 },
        });
      } catch (err) {
        console.error('Error fetching server stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServerInfo();
    // Refresh every 10 seconds
    const interval = setInterval(fetchServerInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const formatMemory = (gb: number) => {
    return `${gb} GB`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const memoryUsedPercent = Math.round(((serverInfo.totalMemory - serverInfo.freeMemory) / serverInfo.totalMemory) * 100);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
          ⟳ Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text" style={{ color: 'var(--neon-green)' }}>
            🖥️ Server Overview
          </h1>
          <p className="mt-1 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            ▸ System information and resource usage ◂
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* System Info */}
        <div className="card-vapor p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4 neon-text" style={{ color: 'var(--neon-cyan)' }}>
            💻 System Information
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>🌐 HOSTNAME</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{serverInfo.hostname}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>🐧 PLATFORM</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{serverInfo.platform}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>⚙️ ARCH</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{serverInfo.arch}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>⏱️ UPTIME</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--neon-green)' }}>{formatUptime(serverInfo.uptime)}</dd>
            </div>
          </dl>
        </div>

        {/* Resources */}
        <div className="card-vapor p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4 neon-text" style={{ color: 'var(--neon-pink)' }}>
            ⚡ Resources
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>🔥 CPU CORES</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{serverInfo.cpus} cores</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>💾 TOTAL MEMORY</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{formatMemory(serverInfo.totalMemory)}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>✨ AVAILABLE</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--neon-green)' }}>{formatMemory(serverInfo.freeMemory)}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold mb-2" style={{ color: 'var(--neon-purple)' }}>📊 MEMORY USAGE</dt>
              <dd>
                <div className="overflow-hidden h-4 rounded-lg" style={{
                  background: 'rgba(26, 10, 46, 0.6)',
                  border: '1px solid rgba(0, 255, 255, 0.3)'
                }}>
                  <div
                    style={{
                      width: `${memoryUsedPercent}%`,
                      background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-pink) 100%)',
                      boxShadow: '0 0 10px var(--neon-cyan)'
                    }}
                    className="h-full transition-all"
                  ></div>
                </div>
                <p className="text-xs font-mono mt-2" style={{ color: 'var(--neon-yellow)' }}>
                  {memoryUsedPercent}% used
                </p>
              </dd>
            </div>
          </dl>
        </div>

        {/* Docker Info */}
        <div className="card-vapor p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4 neon-text" style={{ color: 'var(--neon-purple)' }}>
            🐳 Docker
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>📦 VERSION</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{serverInfo.dockerVersion}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>🚀 CONTAINERS</dt>
              <dd className="text-sm font-mono badge-running">{serverInfo.containerCount} RUNNING</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>💿 IMAGES</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--neon-cyan)' }}>{serverInfo.imageCount} total</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="mt-6">
        <h2 className="text-2xl font-bold neon-text mb-4" style={{ color: 'var(--neon-cyan)' }}>
          📊 Real-time Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU Usage */}
          <div className="card-vapor p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>🔥 CPU USAGE</h3>
              <span className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
                {serverInfo.cpuUsage}%
              </span>
            </div>
            <div className="overflow-hidden h-3 rounded-lg" style={{
              background: 'rgba(26, 10, 46, 0.6)',
              border: '1px solid rgba(0, 255, 255, 0.3)'
            }}>
              <div
                style={{
                  width: `${serverInfo.cpuUsage}%`,
                  background: serverInfo.cpuUsage > 80 ? 'linear-gradient(90deg, #ff6b6b 0%, var(--neon-pink) 100%)' : 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-purple) 100%)',
                  boxShadow: `0 0 10px ${serverInfo.cpuUsage > 80 ? 'var(--neon-pink)' : 'var(--neon-cyan)'}`
                }}
                className="h-full transition-all duration-500"
              ></div>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="card-vapor p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>💾 MEMORY</h3>
              <span className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-pink)' }}>
                {memoryUsedPercent}%
              </span>
            </div>
            <div className="overflow-hidden h-3 rounded-lg" style={{
              background: 'rgba(26, 10, 46, 0.6)',
              border: '1px solid rgba(255, 16, 240, 0.3)'
            }}>
              <div
                style={{
                  width: `${memoryUsedPercent}%`,
                  background: memoryUsedPercent > 80 ? 'linear-gradient(90deg, #ff6b6b 0%, var(--neon-pink) 100%)' : 'linear-gradient(90deg, var(--neon-pink) 0%, var(--neon-purple) 100%)',
                  boxShadow: `0 0 10px ${memoryUsedPercent > 80 ? '#ff6b6b' : 'var(--neon-pink)'}`
                }}
                className="h-full transition-all duration-500"
              ></div>
            </div>
            <p className="text-xs font-mono mt-2 opacity-70" style={{ color: 'var(--text-secondary)' }}>
              {serverInfo.totalMemory - serverInfo.freeMemory} / {serverInfo.totalMemory} GB
            </p>
          </div>

          {/* Disk Usage */}
          <div className="card-vapor p-6 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: 'var(--neon-purple)' }}>💿 DISK</h3>
              <span className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-green)' }}>
                {serverInfo.diskUsage.percentage}%
              </span>
            </div>
            <div className="overflow-hidden h-3 rounded-lg" style={{
              background: 'rgba(26, 10, 46, 0.6)',
              border: '1px solid rgba(57, 255, 20, 0.3)'
            }}>
              <div
                style={{
                  width: `${serverInfo.diskUsage.percentage}%`,
                  background: serverInfo.diskUsage.percentage > 80 ? 'linear-gradient(90deg, #ff6b6b 0%, var(--neon-pink) 100%)' : 'linear-gradient(90deg, var(--neon-green) 0%, var(--neon-cyan) 100%)',
                  boxShadow: `0 0 10px ${serverInfo.diskUsage.percentage > 80 ? '#ff6b6b' : 'var(--neon-green)'}`
                }}
                className="h-full transition-all duration-500"
              ></div>
            </div>
            <p className="text-xs font-mono mt-2 opacity-70" style={{ color: 'var(--text-secondary)' }}>
              {formatBytes(serverInfo.diskUsage.used)} / {formatBytes(serverInfo.diskUsage.total)}
            </p>
          </div>

          {/* Network Stats */}
          <div className="card-vapor p-6 rounded-xl">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--neon-purple)' }}>🌐 NETWORK</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>⬇️ Received</span>
                <span className="text-sm font-bold" style={{ color: 'var(--neon-cyan)' }}>
                  {formatBytes(serverInfo.networkStats.received)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>⬆️ Transmitted</span>
                <span className="text-sm font-bold" style={{ color: 'var(--neon-pink)' }}>
                  {formatBytes(serverInfo.networkStats.transmitted)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
