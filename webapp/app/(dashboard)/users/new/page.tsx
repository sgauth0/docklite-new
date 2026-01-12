'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateUserPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    isAdmin: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          isAdmin: formData.isAdmin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        setLoading(false);
        return;
      }

      router.push('/users');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/users" className="text-sm font-bold hover:scale-105 transition-transform inline-block" style={{ color: 'var(--neon-cyan)' }}>
          ← Back to Users
        </Link>
        <h1 className="mt-4 text-4xl font-bold neon-text" style={{ color: 'var(--neon-pink)' }}>
          ➕ Create New User
        </h1>
      </div>

      <div className="card-vapor p-8 rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg p-4 font-bold" style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 16, 240, 0.2) 100%)',
              border: '2px solid rgba(255, 107, 107, 0.5)',
              color: '#ff6b6b'
            }}>
              ❌ {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-cyan)' }}>
              👤 USERNAME
            </label>
            <input
              type="text"
              id="username"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input-vapor w-full font-mono"
              placeholder="enter username..."
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
              🔐 PASSWORD
            </label>
            <input
              type="password"
              id="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input-vapor w-full font-mono"
              placeholder="••••••••"
            />
            <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              Minimum 6 characters
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-purple)' }}>
              🔒 CONFIRM PASSWORD
            </label>
            <input
              type="password"
              id="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="input-vapor w-full font-mono"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
            <input
              type="checkbox"
              id="isAdmin"
              checked={formData.isAdmin}
              onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <label htmlFor="isAdmin" className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--neon-yellow)' }}>
              <span>👑</span>
              <span>Administrator (full access to all sites and settings)</span>
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link
              href="/users"
              className="px-6 py-3 rounded-xl font-bold transition-all hover:scale-105"
              style={{
                background: 'rgba(128, 128, 128, 0.2)',
                color: 'var(--text-secondary)',
                border: '2px solid rgba(128, 128, 128, 0.3)'
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-neon px-8 py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⟳ Creating...' : '✨ Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
