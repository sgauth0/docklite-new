'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SystemSettingsPage() {
  const [checkingFolders, setCheckingFolders] = useState(false);
  const [folderCheckResult, setFolderCheckResult] = useState<string | null>(null);

  const handleCheckFolders = async () => {
    setCheckingFolders(true);
    setFolderCheckResult(null);

    try {
      const res = await fetch('/api/system/check-folders', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setFolderCheckResult(`✓ Success: Checked ${data.userCount} users`);
      } else {
        setFolderCheckResult(`✗ Error: ${data.error}`);
      }
    } catch (err: any) {
      setFolderCheckResult(`✗ Error: ${err.message}`);
    } finally {
      setCheckingFolders(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
            🖥️ System Settings
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            ▶ DOCKER DAEMON CONFIGURATION ◀
          </p>
        </div>
        <Link
          href="/settings"
          className="cyber-button inline-flex items-center gap-2"
        >
          ← Back to Settings
        </Link>
      </div>

      {/* Docker Status */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-4" style={{ color: 'var(--neon-green)' }}>
          🐳 Docker Connection
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full animate-pulse bg-green-500"></div>
            <div>
              <div className="font-bold text-lg">Connected</div>
              <div className="text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>
                Docker daemon status
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono opacity-70">Socket: /var/run/docker.sock</div>
            <div className="text-xs opacity-50">Version: API 1.41+</div>
          </div>
        </div>
      </div>

      {/* Configuration Options */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-yellow)' }}>
          ⚙️ Configuration
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-purple-500/20">
            <div>
              <div className="font-bold">Auto-refresh containers</div>
              <div className="text-sm opacity-70">Automatically refresh container status every 10 seconds</div>
            </div>
            <button className="px-4 py-2 rounded-lg font-bold transition-all" style={{ background: 'var(--neon-green)', color: 'var(--bg-darker)' }}>
              ON
            </button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-purple-500/20">
            <div>
              <div className="font-bold">Container logs retention</div>
              <div className="text-sm opacity-70">Keep container logs for 7 days</div>
            </div>
            <button className="px-4 py-2 rounded-lg font-bold transition-all" style={{ background: 'var(--neon-purple)', color: 'white' }}>
              7 days
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Tools */}
      <div className="card-vapor p-6 rounded-xl">
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-pink)' }}>
          🔧 Maintenance Tools
        </h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-purple-500/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-lg mb-2">User Folder Check</div>
                <div className="text-sm opacity-70" style={{ color: 'var(--text-secondary)' }}>
                  Ensures all users have their home directories created in /var/www/sites/
                  <br />
                  This runs automatically on startup, but you can trigger it manually here.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleCheckFolders}
                disabled={checkingFolders}
                className="px-6 py-3 rounded-lg font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: checkingFolders
                    ? 'rgba(100, 100, 100, 0.3)'
                    : 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-purple) 100%)',
                  color: 'white',
                }}
              >
                {checkingFolders ? '⟳ Checking...' : '▶ Run Folder Check'}
              </button>
              {folderCheckResult && (
                <div
                  className="px-4 py-2 rounded-lg font-mono text-sm"
                  style={{
                    background: folderCheckResult.startsWith('✓')
                      ? 'rgba(57, 255, 20, 0.2)'
                      : 'rgba(255, 107, 107, 0.2)',
                    color: folderCheckResult.startsWith('✓')
                      ? 'var(--neon-green)'
                      : '#ff6b6b',
                    border: `1px solid ${folderCheckResult.startsWith('✓') ? 'var(--neon-green)' : '#ff6b6b'}`,
                  }}
                >
                  {folderCheckResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
