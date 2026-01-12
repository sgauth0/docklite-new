'use client';

import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { useToast } from '@/lib/hooks/useToast';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: string;
  labels: Record<string, string>;
  tracked?: boolean;
}

interface AllContainersModalProps {
  onClose: () => void;
}

export default function AllContainersModal({ onClose }: AllContainersModalProps) {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [containerToDelete, setContainerToDelete] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const fetchAllContainers = async () => {
    try {
      const res = await fetch('/api/containers/all');
      if (!res.ok) throw new Error('Failed to fetch containers');
      const data = await res.json();
      setContainers(data.containers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllContainers();
  }, []);

  const handleAction = async (containerId: string, action: 'start' | 'stop' | 'restart' | 'delete', containerName?: string) => {
    try {
      if (action === 'delete') {
        setContainerToDelete({ id: containerId, name: containerName || containerId });
        return;
      } else {
        const res = await fetch(`/api/containers/${containerId}/${action}`, {
          method: 'POST',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to ${action} container`);
        }
        toast.success(`Container ${action}ed successfully!`);
      }
      fetchAllContainers(); // Refresh list
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleTracking = async (containerId: string, tracked: boolean) => {
    try {
      const endpoint = tracked ? 'untrack' : 'track';
      const res = await fetch(`/api/containers/${containerId}/${endpoint}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${endpoint} container`);
      }
      toast.success(tracked ? 'Container untracked' : 'Container tracked');
      fetchAllContainers();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!containerToDelete) return;

    try {
      const res = await fetch(`/api/containers/${containerToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete container');
      toast.success(`Container "${containerToDelete.name}" deleted successfully!`);
      setContainerToDelete(null);
      fetchAllContainers();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setContainerToDelete(null);
    }
  };

  const isDockliteManaged = (container: DockerContainer) => {
    return container.labels?.['docklite.managed'] === 'true';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-vapor max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{
        background: 'linear-gradient(135deg, rgba(26, 10, 46, 0.98) 0%, rgba(10, 5, 16, 0.95) 100%)'
      }}>
        {/* Header */}
        <div className="p-6 border-b border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
                🐳 All Docker Containers
              </h2>
              <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                Complete list of all containers on this host
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-lg font-bold transition-all hover:scale-105"
              style={{
                background: 'rgba(255, 107, 107, 0.2)',
                border: '1px solid #ff6b6b',
                color: '#ff6b6b',
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-pulse" style={{ color: 'var(--neon-cyan)' }}>⚡</div>
              <p className="font-mono" style={{ color: 'var(--text-secondary)' }}>Loading containers...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && containers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📦</div>
              <p className="font-mono" style={{ color: 'var(--text-secondary)' }}>No containers found</p>
            </div>
          )}

          {!loading && !error && containers.length > 0 && (
            <div className="space-y-3">
              {containers.map(container => {
                const isRunning = container.state === 'running';
                const isManaged = isDockliteManaged(container);
                const isTracked = container.tracked !== false;

                return (
                  <div
                    key={container.id}
                    className="p-4 rounded-lg border transition-all hover:scale-[1.01]"
                    style={{
                      background: isManaged
                        ? 'linear-gradient(135deg, rgba(57, 255, 20, 0.1) 0%, rgba(0, 255, 255, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(100, 100, 100, 0.1) 0%, rgba(60, 60, 60, 0.1) 100%)',
                      borderColor: isManaged ? 'rgba(57, 255, 20, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold truncate" style={{ color: 'var(--neon-cyan)' }}>
                            {container.name}
                          </h3>
                          {isManaged && (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-bold flex-shrink-0"
                              style={{
                                background: 'rgba(57, 255, 20, 0.2)',
                                color: 'var(--neon-green)',
                                border: '1px solid var(--neon-green)',
                              }}
                            >
                              ⚡ DockLite
                            </span>
                          )}
                          <span
                            className="px-2 py-1 rounded-full text-xs font-bold flex-shrink-0"
                            style={{
                              background: isRunning ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 107, 107, 0.2)',
                              color: isRunning ? 'var(--neon-green)' : '#ff6b6b',
                              border: `1px solid ${isRunning ? 'var(--neon-green)' : '#ff6b6b'}`,
                            }}
                          >
                            {isRunning ? '● RUNNING' : '○ STOPPED'}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs font-mono opacity-75" style={{ color: 'var(--text-secondary)' }}>
                          <div>🖼️ Image: {container.image}</div>
                          <div>🆔 ID: {container.id.substring(0, 12)}</div>
                          <div>📅 Status: {container.status}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleTracking(container.id, isTracked)}
                          className="px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                          style={{
                            background: isTracked
                              ? 'rgba(255, 107, 107, 0.2)'
                              : 'rgba(57, 255, 20, 0.2)',
                            border: `1px solid ${isTracked ? '#ff6b6b' : 'var(--neon-green)'}`,
                            color: isTracked ? '#ff6b6b' : 'var(--neon-green)',
                          }}
                          title={isTracked ? 'Untrack container' : 'Track container'}
                        >
                          {isTracked ? '👁️‍🗨️' : '👁️'}
                        </button>
                        {!isRunning ? (
                          <button
                            onClick={() => handleAction(container.id, 'start')}
                            className="px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                            style={{
                              background: 'linear-gradient(135deg, var(--neon-green) 0%, var(--neon-cyan) 100%)',
                              color: 'var(--bg-darker)',
                            }}
                          >
                            ▶
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleAction(container.id, 'restart')}
                              className="px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                              style={{
                                background: 'linear-gradient(135deg, var(--neon-yellow) 0%, var(--neon-pink) 100%)',
                                color: 'var(--bg-darker)',
                              }}
                            >
                              ⟳
                            </button>
                            <button
                              onClick={() => handleAction(container.id, 'stop')}
                              className="px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                              style={{
                                background: 'linear-gradient(135deg, #ff6b6b 0%, var(--neon-pink) 100%)',
                                color: 'white',
                              }}
                            >
                              ■
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleAction(container.id, 'delete', container.name)}
                          className="px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                          style={{
                            background: 'rgba(255, 107, 107, 0.2)',
                            border: '1px solid #ff6b6b',
                            color: '#ff6b6b',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-500/30 text-center">
          <p className="text-xs font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>
            Total: {containers.length} containers ({containers.filter(c => c.state === 'running').length} running)
          </p>
        </div>
      </div>

      {containerToDelete && (
        <ConfirmModal
          title="Delete Container"
          message={`Are you sure you want to delete container "${containerToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setContainerToDelete(null)}
        />
      )}

      <toast.ToastContainer />
    </div>
  );
}
