'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightning,
  Sparkle,
  Database,
  UserCircle,
  Lock,
  XCircle,
  Info,
  CheckCircle,
  SignIn,
} from '@phosphor-icons/react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Hard redirect to ensure session is loaded
      window.location.href = '/';
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center retro-grid">
      <div className="max-w-md w-full space-y-8 p-10 card-vapor neon-border">
        <div className="text-center">
          <h2 className="text-5xl font-bold neon-text mb-2 flex items-center justify-center gap-3" style={{ color: 'var(--neon-cyan)' }}>
            <Lightning size={32} weight="duotone" />
            DockLite
            <Sparkle size={26} weight="duotone" />
          </h2>
          <p className="text-lg font-bold flex items-center justify-center gap-2" style={{ color: 'var(--neon-pink)' }}>
            <Sparkle size={18} weight="duotone" />
            Docker Control Panel
            <Database size={18} weight="duotone" />
          </p>
          <div className="mt-4 text-xs" style={{ color: 'var(--neon-purple)' }}>
            ▸ CYBER KAWAII EDITION ◂
          </div>
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
          method="POST"
          action="/api/auth/login"
        >
          {error && (
            <div className="rounded-lg p-4 font-bold text-center" style={{
              background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 16, 240, 0.2) 100%)',
              border: '2px solid rgba(255, 107, 107, 0.5)',
              color: '#ff6b6b'
            }}>
              <span className="inline-flex items-center gap-2">
                <XCircle size={18} weight="duotone" />
                {error}
              </span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--neon-cyan)' }}>
                <UserCircle size={18} weight="duotone" />
                USERNAME
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-vapor w-full font-mono"
                placeholder="enter username..."
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--neon-pink)' }}>
                <Lock size={18} weight="duotone" />
                PASSWORD
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-vapor w-full font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-neon py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : (
              <span className="inline-flex items-center gap-2">
                <SignIn size={18} weight="duotone" />
                Sign In
              </span>
            )}
          </button>

          <p className="mt-6 text-center text-xs font-mono flex items-center justify-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Info size={14} weight="duotone" />
            Default: superadmin / admin
          </p>

          <div className="mt-4 text-center text-xs font-mono" style={{ color: 'var(--neon-purple)' }}>
            ━━━━━━━━━━━━━━━━━━━━━━━
            <br />
            <span className="inline-flex items-center gap-2">
              <CheckCircle size={14} weight="duotone" />
              SYSTEM ONLINE
            </span>
            <br />
            ━━━━━━━━━━━━━━━━━━━━━━━
          </div>
        </form>
      </div>
    </div>
  );
}
