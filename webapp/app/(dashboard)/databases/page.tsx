'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database as DatabaseType } from '@/types';
import DbViewer from './DbViewer';
import SkeletonLoader from '../components/SkeletonLoader';
import { Database, DotsThree, PencilSimpleLine, SignIn, Trash } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

interface DatabaseWithSize extends DatabaseType {
  size: number;
  sizeCategory: 'empty' | 'tiny' | 'small' | 'medium' | 'large' | 'huge';
}

interface DockliteDbInfo {
  size: number;
  tables: number;
  path: string;
}

export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<DatabaseWithSize[]>([]);
  const [dockliteDb, setDockliteDb] = useState<DockliteDbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbUsername, setNewDbUsername] = useState('docklite');
  const [newDbPassword, setNewDbPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [editingDb, setEditingDb] = useState<DatabaseWithSize | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [menuDbId, setMenuDbId] = useState<number | null>(null);
  const [deleteDb, setDeleteDb] = useState<DatabaseWithSize | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingDb, setDeletingDb] = useState(false);
  const [editModeDb, setEditModeDb] = useState<DatabaseWithSize | null>(null);
  const [editModeUsername, setEditModeUsername] = useState('');
  const [editModePassword, setEditModePassword] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuPopupRef = useRef<HTMLDivElement>(null);
  const stopMenu = (event: React.PointerEvent) => event.stopPropagation();

  const fetchDatabases = async () => {
    try {
      const res = await fetch('/api/databases/stats');
      if (!res.ok) throw new Error('Failed to fetch databases');

      const data = await res.json();
      setDatabases(data.databases);
      setDockliteDb(data.dockliteDb);
      setLoading(false);
    } catch (err) {
      setError('Failed to load databases');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
    const interval = setInterval(fetchDatabases, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-db-menu="true"]')) {
        setMenuDbId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDbName,
          username: newDbUsername,
          password: newDbPassword || undefined, // Let backend generate if empty
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create database');
      }

      const data = await res.json();
      setConnectionInfo(data.connection);
      setNewDbName('');
      setNewDbUsername('docklite');
      setNewDbPassword('');
      setShowCreateForm(false);
      fetchDatabases();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDb) return;

    setCreating(true);
    setError('');

    try {
      const res = await fetch(`/api/databases/${editingDb.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername,
          password: editPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update database');
      }

      setEditingDb(null);
      setEditUsername('');
      setEditPassword('');
      fetchDatabases();
      alert('✓ Database credentials updated successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (db: DatabaseWithSize) => {
    setEditingDb(db);
    setEditUsername('docklite');
    setEditPassword('');
    setError('');
  };

  const openDeleteModal = (db: DatabaseWithSize) => {
    setDeleteDb(db);
    setDeleteConfirmText('');
    setError('');
  };

  const handleDelete = async () => {
    if (!deleteDb) return;
    setDeletingDb(true);
    setError('');

    try {
      const res = await fetch(`/api/databases/${deleteDb.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete database');
      }
      setDeleteDb(null);
      setDeleteConfirmText('');
      await fetchDatabases();
    } catch (err: any) {
      setError(err.message || 'Failed to delete database');
    } finally {
      setDeletingDb(false);
    }
  };

  const openEditModeModal = (db: DatabaseWithSize) => {
    setEditModeDb(db);
    setEditModeUsername('docklite');
    setEditModePassword('');
    setError('');
  };

  const handleEnterEditMode = () => {
    if (!editModeDb) return;
    if (!editModeUsername || !editModePassword) {
      setError('Database username and password are required for edit mode.');
      return;
    }
    const payload = {
      username: editModeUsername,
      password: editModePassword,
    };
    sessionStorage.setItem(`docklite-db-edit-${editModeDb.id}`, JSON.stringify(payload));
    setEditModeDb(null);
    router.push(`/databases/${editModeDb.id}/edit`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getSizeEmojis = (category: string) => {
    const emojiMap = {
      empty: '',
      tiny: '💾',
      small: '💾💾',
      medium: '💾💾💾',
      large: '💾💾💾💾',
      huge: '💾💾💾💾💾',
    };
    return emojiMap[category as keyof typeof emojiMap] || '';
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl lg:text-4xl font-bold neon-text mb-2" style={{ color: 'var(--neon-purple)' }}>
            💾 Databases
          </h1>
          <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
            ▶ LOADING... ◀
          </p>
        </div>
        <SkeletonLoader type="database" count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <DbViewer />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold neon-text mb-2" style={{ color: 'var(--neon-purple)' }}>
            💾 Databases
          </h1>
          <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
            ▶ DATABASE MANAGEMENT SYSTEM ◀
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-neon inline-flex items-center gap-2"
        >
          {showCreateForm ? '✕ Cancel' : '✨ Create Database'}
        </button>
      </div>

      {error && (
        <div className="mt-4 card-vapor p-4 rounded-lg border-2" style={{ borderColor: 'rgba(255, 107, 107, 0.5)' }}>
          <p className="font-bold" style={{ color: '#ff6b6b' }}>
            ❌ {error}
          </p>
        </div>
      )}

      {connectionInfo && (
        <div className="mt-4 card-vapor p-6 rounded-lg border-2" style={{ borderColor: 'rgba(57, 255, 20, 0.5)' }}>
          <h3 className="text-lg font-bold mb-3 neon-text" style={{ color: 'var(--neon-green)' }}>
            ✓ Database Created Successfully!
          </h3>
          <div className="space-y-2 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--neon-cyan)' }}>🌐 HOST:</span>
              <span>{connectionInfo.host}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--neon-cyan)' }}>🔌 PORT:</span>
              <span>{connectionInfo.port}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--neon-cyan)' }}>💾 DATABASE:</span>
              <span>{connectionInfo.database}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--neon-cyan)' }}>👤 USERNAME:</span>
              <span>{connectionInfo.username}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--neon-cyan)' }}>🔑 PASSWORD:</span>
              <span className="font-bold" style={{ color: 'var(--neon-pink)' }}>{connectionInfo.password}</span>
            </div>
          </div>
          <p className="mt-4 text-xs font-mono" style={{ color: 'var(--neon-yellow)' }}>
            ⚠️ Save these credentials - the password will not be shown again!
          </p>
          <button
            onClick={() => setConnectionInfo(null)}
            className="mt-4 px-3 py-1.5 text-sm rounded-lg font-bold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, var(--neon-green) 0%, var(--neon-cyan) 100%)',
              color: 'var(--bg-darker)',
            }}
          >
            👍 Got it!
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="mt-6 card-vapor p-6 rounded-xl">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-cyan)' }}>
                💾 DATABASE NAME
              </label>
              <input
                type="text"
                id="name"
                required
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                className="input-vapor w-full"
                placeholder="my_awesome_database"
              />
              <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                ▸ Only alphanumeric characters and underscores ◂
              </p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-purple)' }}>
                👤 USERNAME
              </label>
              <input
                type="text"
                id="username"
                required
                value={newDbUsername}
                onChange={(e) => setNewDbUsername(e.target.value)}
                className="input-vapor w-full"
                placeholder="docklite"
              />
              <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                ▸ Default: docklite ◂
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                🔑 PASSWORD
              </label>
              <input
                type="password"
                id="password"
                value={newDbPassword}
                onChange={(e) => setNewDbPassword(e.target.value)}
                className="input-vapor w-full"
                placeholder="Leave empty for auto-generated password"
              />
              <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                ▸ Leave empty to auto-generate a secure password ◂
              </p>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="btn-neon w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '⟳ Creating...' : '✨ Create PostgreSQL Database'}
            </button>
          </form>
        </div>
      )}

      {/* PostgreSQL Databases */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold neon-text mb-4" style={{ color: 'var(--neon-pink)' }}>
          🐘 PostgreSQL Databases
        </h2>

        {databases.length === 0 ? (
          <div className="text-center py-12 card-vapor">
            <p className="text-lg font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
              📭 No PostgreSQL databases yet!
            </p>
            <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              Create your first database to get started ✨
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {databases.map((db) => (
              <div
                key={db.id}
                className="p-6 rounded-xl transition-all hover:scale-[1.02] relative"
                style={{
                  background: 'rgba(10, 5, 20, 0.3)',
                  backdropFilter: 'blur(12px)',
                  border: '2px solid var(--neon-green)',
                  boxShadow: `
                    0 0 3px rgba(107, 255, 176, 1),
                    0 0 6px rgba(107, 255, 176, 0.7),
                    0 0 12px rgba(107, 255, 176, 0.5),
                    0 0 18px rgba(107, 255, 176, 0.35),
                    inset 0 0 2px rgba(107, 255, 176, 0.9),
                    inset 0 0 4px rgba(107, 255, 176, 0.6),
                    inset 0 0 8px rgba(107, 255, 176, 0.4)
                  `,
                }}
              >
                {/* 3-dot menu */}
                <div className="absolute top-4 right-4 z-10" data-db-menu="true">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextOpen = menuDbId === db.id ? null : db.id;
                      setMenuDbId(nextOpen);
                      if (nextOpen !== null && typeof window !== 'undefined') {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        const menuWidth = 200;
                        const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
                        setMenuPosition({ top: rect.bottom + 8, left });
                      } else {
                        setMenuPosition(null);
                      }
                    }}
                    className="p-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                    style={{
                      background: 'transparent',
                      border: '2px solid var(--neon-purple)',
                      color: 'var(--neon-purple)',
                      boxShadow: `
                        0 0 5px rgba(181, 55, 242, 0.6),
                        0 0 10px rgba(181, 55, 242, 0.3)
                      `,
                    }}
                    title="Database actions"
                  >
                    <DotsThree size={16} weight="bold" />
                  </button>

                  {menuDbId === db.id && menuPosition && typeof document !== 'undefined' &&
                    createPortal(
                      <div
                        className="fixed inset-0 z-[10000]"
                        onClick={() => {
                          setMenuDbId(null);
                          setMenuPosition(null);
                        }}
                        onPointerDown={stopMenu}
                        onPointerDownCapture={stopMenu}
                      >
                        <div
                          ref={menuPopupRef}
                          className="absolute rounded-lg overflow-hidden animate-slide-down"
                          style={{
                            top: menuPosition.top,
                            left: menuPosition.left,
                            background: 'linear-gradient(135deg, rgba(26, 10, 46, 0.98) 0%, rgba(10, 5, 30, 0.98) 100%)',
                            border: '1px solid var(--neon-purple)',
                            boxShadow: '0 0 20px rgba(181, 55, 242, 0.4)',
                            width: '200px',
                            maxWidth: 'calc(100vw - 24px)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={stopMenu}
                          onPointerDownCapture={stopMenu}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuDbId(null);
                              setMenuPosition(null);
                              openEditModal(db);
                            }}
                            onPointerDown={stopMenu}
                            onPointerDownCapture={stopMenu}
                            className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                            style={{ color: 'var(--neon-cyan)' }}
                          >
                            <PencilSimpleLine size={16} weight="duotone" />
                            Edit Credentials
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuDbId(null);
                              setMenuPosition(null);
                              openEditModeModal(db);
                            }}
                            onPointerDown={stopMenu}
                            onPointerDownCapture={stopMenu}
                            className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                            style={{ color: 'var(--neon-purple)' }}
                          >
                            <SignIn size={16} weight="duotone" />
                            Edit Database Mode
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuDbId(null);
                              setMenuPosition(null);
                              openDeleteModal(db);
                            }}
                            onPointerDown={stopMenu}
                            onPointerDownCapture={stopMenu}
                            className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-red-500/20 flex items-center gap-3"
                            style={{ color: '#ff6b6b' }}
                          >
                            <Trash size={16} weight="duotone" />
                            Delete Database
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}
                </div>

                {/* Header with centered database icon */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold neon-text truncate" style={{ color: 'var(--neon-cyan)' }}>
                    {db.name}
                  </h3>
                  <div className="mt-3 flex justify-center pointer-events-none">
                    <Database
                      size={46}
                      weight="duotone"
                      style={{
                        color: 'var(--neon-cyan)',
                        filter: 'drop-shadow(0 0 8px rgba(79, 214, 255, 0.7)) drop-shadow(0 0 14px rgba(79, 214, 255, 0.45))',
                      }}
                    />
                  </div>
                </div>

                {/* Size badge */}
                <div className="mb-4">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: db.size === 0
                        ? 'rgba(100, 100, 100, 0.2)'
                        : 'rgba(57, 255, 20, 0.2)',
                      color: db.size === 0 ? '#999' : 'var(--neon-green)',
                      border: `1px solid ${db.size === 0 ? '#666' : 'var(--neon-green)'}`,
                    }}
                  >
                    {db.size === 0 ? '○ EMPTY' : `● ${formatBytes(db.size)}`}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <span className="opacity-60" style={{ color: 'var(--text-secondary)' }}>🔌 Port:</span>
                    <span className="font-bold" style={{ color: 'var(--neon-purple)' }}>
                      {db.postgres_port}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60" style={{ color: 'var(--text-secondary)' }}>🆔 ID:</span>
                    <span className="opacity-70 text-xs">
                      {db.container_id.substring(0, 12)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60" style={{ color: 'var(--text-secondary)' }}>📅 Created:</span>
                    <span className="opacity-70 text-xs">
                      {new Date(db.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Connection hint */}
                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <p className="text-xs font-mono opacity-60 mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Connect: localhost:{db.postgres_port}
                  </p>
                  <p className="text-xs font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>
                    Use the menu for credentials or deletion.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 card-vapor p-6 rounded-xl border-2" style={{ borderColor: 'rgba(0, 255, 255, 0.3)' }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-sm font-bold mb-2" style={{ color: 'var(--neon-cyan)' }}>
              🔗 CONNECTION INFO
            </p>
            <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              Connect to your PostgreSQL databases using <span className="font-bold" style={{ color: 'var(--neon-pink)' }}>localhost</span> as the host and the port shown on each card.
              Default username is <span className="font-bold" style={{ color: 'var(--neon-pink)' }}>docklite</span>. Password is generated randomly during creation.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Database Modal */}
      {editingDb && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-vapor max-w-lg w-full p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
                ✏️ Edit Database Credentials
              </h2>
              <p className="text-sm font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                {editingDb.name}
              </p>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label htmlFor="edit-username" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-purple)' }}>
                  👤 NEW USERNAME
                </label>
                <input
                  type="text"
                  id="edit-username"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="input-vapor w-full"
                  placeholder="docklite"
                />
              </div>

              <div>
                <label htmlFor="edit-password" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                  🔑 NEW PASSWORD
                </label>
                <input
                  type="password"
                  id="edit-password"
                  required
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="input-vapor w-full"
                  placeholder="Enter new password"
                />
              </div>

              <div className="p-4 rounded-lg" style={{ background: 'rgba(255, 165, 0, 0.1)', border: '1px solid rgba(255, 165, 0, 0.3)' }}>
                <p className="text-xs font-mono" style={{ color: 'var(--neon-yellow)' }}>
                  ⚠️ This will update the PostgreSQL user credentials in the database container.
                  Make sure to update your application connection strings!
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDb(null);
                    setEditUsername('');
                    setEditPassword('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105"
                  style={{
                    background: 'rgba(100, 100, 100, 0.3)',
                    border: '2px solid var(--text-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  ✕ Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-purple) 100%)',
                    color: 'white',
                  }}
                >
                  {creating ? '⟳ Updating...' : '✓ Update Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Database Modal */}
      {deleteDb && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-vapor max-w-lg w-full p-8 border-2" style={{ borderColor: '#ff6b6b' }}>
            <div className="mb-6 text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold neon-text mb-2" style={{ color: '#ff6b6b' }}>
                Delete Database
              </h2>
              <p className="text-sm font-mono opacity-80" style={{ color: 'var(--text-secondary)' }}>
                This deletes the PostgreSQL container and all data. This cannot be undone.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-red-500/40" style={{ background: 'rgba(255, 107, 107, 0.08)' }}>
                <p className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
                  Type <span className="font-bold">{deleteDb.name}</span> to confirm deletion.
                </p>
              </div>

              <div>
                <label htmlFor="delete-confirm" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                  Confirm Database Name
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="input-vapor w-full"
                  placeholder={deleteDb.name}
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteDb(null);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105"
                  style={{
                    background: 'rgba(100, 100, 100, 0.3)',
                    border: '2px solid var(--text-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  ✕ Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingDb || deleteConfirmText !== deleteDb.name}
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #ff6b6b 0%, var(--neon-pink) 100%)',
                    color: 'white',
                  }}
                >
                  {deletingDb ? '⟳ Deleting...' : 'Delete Database'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enter Edit Mode Modal */}
      {editModeDb && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-vapor max-w-lg w-full p-8 border-2" style={{ borderColor: 'var(--neon-purple)' }}>
            <div className="mb-6 text-center">
              <div className="text-5xl mb-4">🧠</div>
              <h2 className="text-2xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
                DO YOU WANT TO EDIT MODE?
              </h2>
              <p className="text-sm font-mono opacity-80" style={{ color: 'var(--text-secondary)' }}>
                Enter database credentials to access live schema tools and SQL runner.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-mode-username" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-purple)' }}>
                  👤 DATABASE USERNAME
                </label>
                <input
                  id="edit-mode-username"
                  type="text"
                  value={editModeUsername}
                  onChange={(e) => setEditModeUsername(e.target.value)}
                  className="input-vapor w-full"
                  placeholder="docklite"
                />
              </div>

              <div>
                <label htmlFor="edit-mode-password" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                  🔑 DATABASE PASSWORD
                </label>
                <input
                  id="edit-mode-password"
                  type="password"
                  value={editModePassword}
                  onChange={(e) => setEditModePassword(e.target.value)}
                  className="input-vapor w-full"
                  placeholder="Enter database password"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditModeDb(null);
                    setEditModeUsername('');
                    setEditModePassword('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105"
                  style={{
                    background: 'rgba(100, 100, 100, 0.3)',
                    border: '2px solid var(--text-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  ✕ Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEnterEditMode}
                  className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-purple) 100%)',
                    color: 'white',
                  }}
                >
                  ✓ Enter Edit Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
