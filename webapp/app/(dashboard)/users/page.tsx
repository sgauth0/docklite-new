'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
}

interface CurrentUser {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changePasswordUser, setChangePasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchUsers = async () => {
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/auth/me'),
      ]);

      if (!usersRes.ok) throw new Error('Failed to fetch users');

      const usersData = await usersRes.json();
      setUsers(usersData.users);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData.user);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load users');
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!changePasswordUser || !newPassword) return;

    setChangingPassword(true);
    try {
      const res = await fetch('/api/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: changePasswordUser.id,
          newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        setChangingPassword(false);
        return;
      }

      setChangePasswordUser(null);
      setNewPassword('');
      alert('Password changed successfully!');
    } catch (err) {
      alert('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4 animate-float">⚡</div>
        <div className="text-2xl font-bold neon-text animate-pulse" style={{ color: 'var(--neon-cyan)' }}>
          Loading users...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">⚠️</div>
        <div className="text-xl font-bold mb-4" style={{ color: '#ff6b6b' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
            👥 User Management
          </h1>
          <p className="text-xs font-mono mt-2" style={{ color: 'var(--text-secondary)' }}>
            ▸ Manage system users and permissions ◂
          </p>
        </div>
        <Link
          href="/users/new"
          className="btn-neon inline-flex items-center gap-2"
        >
          <span>➕</span>
          <span>Create User</span>
        </Link>
      </div>

      <div className="card-vapor rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-purple-500/20">
            <thead style={{ background: 'rgba(26, 10, 46, 0.8)' }}>
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--neon-cyan)' }}>
                  USERNAME
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--neon-cyan)' }}>
                  ROLE
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--neon-cyan)' }}>
                  CREATED
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold" style={{ color: 'var(--neon-cyan)' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/10">
              {users.map((user) => {
                const isCurrentUser = currentUser && user.id === currentUser.userId;
                return (
                  <tr key={user.id} className="hover:bg-purple-900/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {user.username}
                        </span>
                        {user.is_admin === 1 && <span className="text-sm">👑</span>}
                        {isCurrentUser && (
                          <span
                            className="px-2 py-1 text-xs font-bold rounded-full animate-pulse"
                            style={{
                              background: 'rgba(57, 255, 20, 0.2)',
                              color: 'var(--neon-green)',
                              border: '1px solid var(--neon-green)',
                            }}
                          >
                            ● YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_admin === 1 ? (
                        <span
                          className="px-3 py-1 inline-flex text-xs font-bold rounded-full"
                          style={{
                            background: 'rgba(255, 215, 0, 0.2)',
                            color: 'var(--neon-yellow)',
                            border: '1px solid var(--neon-yellow)',
                          }}
                        >
                          ADMIN
                        </span>
                      ) : (
                        <span
                          className="px-3 py-1 inline-flex text-xs font-bold rounded-full"
                          style={{
                            background: 'rgba(0, 255, 255, 0.2)',
                            color: 'var(--neon-cyan)',
                            border: '1px solid var(--neon-cyan)',
                          }}
                        >
                          USER
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {currentUser?.isAdmin && (
                        <button
                          onClick={() => {
                            setChangePasswordUser(user);
                            setNewPassword('');
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105"
                          style={{
                            background: 'linear-gradient(135deg, var(--neon-purple) 0%, var(--neon-pink) 100%)',
                            color: 'white',
                            boxShadow: '0 0 8px rgba(181, 55, 242, 0.4)',
                          }}
                        >
                          🔐 Change Password
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 card-vapor mt-6">
          <div className="text-6xl mb-4">👤</div>
          <p className="text-lg font-bold neon-text" style={{ color: 'var(--neon-pink)' }}>
            No users yet
          </p>
          <p className="text-sm font-mono mt-2" style={{ color: 'var(--text-secondary)' }}>
            Create your first user to get started
          </p>
        </div>
      )}

      {/* Change Password Modal */}
      {changePasswordUser && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[9999] flex items-center justify-center p-4"
          onClick={() => setChangePasswordUser(null)}
        >
          <div
            className="card-vapor neon-border max-w-md w-full p-6 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(10, 5, 30, 0.98) 0%, rgba(26, 10, 46, 0.95) 100%)',
              border: '2px solid rgba(255, 16, 240, 0.5)',
            }}
          >
            <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-pink)' }}>
              🔐 Change Password
            </h2>

            <div className="mb-6">
              <p className="text-sm font-mono mb-2" style={{ color: 'var(--text-secondary)' }}>
                Changing password for:
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(0, 255, 255, 0.1)' }}>
                <span className="font-bold text-lg" style={{ color: 'var(--neon-cyan)' }}>
                  {changePasswordUser.username}
                </span>
                {changePasswordUser.is_admin === 1 && <span className="text-sm">👑</span>}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-purple)' }}>
                NEW PASSWORD
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-vapor w-full font-mono"
                placeholder="Enter new password..."
                minLength={6}
                autoFocus
              />
              <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Minimum 6 characters
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setChangePasswordUser(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold transition-all hover:scale-105"
                style={{
                  background: 'rgba(128, 128, 128, 0.2)',
                  color: 'var(--text-secondary)',
                  border: '2px solid rgba(128, 128, 128, 0.3)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || newPassword.length < 6}
                className="flex-1 px-4 py-3 rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--neon-purple) 0%, var(--neon-pink) 100%)',
                  color: 'white',
                  boxShadow: '0 0 12px rgba(181, 55, 242, 0.4)',
                }}
              >
                {changingPassword ? '⟳ Changing...' : '✨ Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
