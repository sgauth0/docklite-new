'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen retro-grid scanlines flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* 404 Big Text */}
        <div className="mb-8">
          <h1
            className="text-9xl font-bold neon-text mb-4 animate-pulse glitch"
            style={{ color: 'var(--neon-pink)' }}
          >
            404
          </h1>
          <div className="text-6xl mb-6">😵</div>
        </div>

        {/* Error Message */}
        <div className="card-vapor p-8 rounded-xl border-2 border-pink-500/30 mb-6">
          <h2 className="text-3xl font-bold neon-text mb-4" style={{ color: 'var(--neon-cyan)' }}>
            ⚠️ Page Not Found
          </h2>
          <p className="text-lg font-mono mb-6" style={{ color: 'var(--text-secondary)' }}>
            The page you&apos;re looking for doesn&apos;t exist in the DockLite matrix.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="btn-neon inline-flex items-center gap-2 justify-center"
            >
              <span>🏠</span>
              <span>Go Home</span>
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 border"
              style={{
                borderColor: 'rgba(0, 255, 255, 0.5)',
                color: 'var(--neon-cyan)',
                background: 'rgba(0, 255, 255, 0.1)'
              }}
            >
              ← Go Back
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/"
            className="card-vapor p-4 rounded-lg border border-purple-500/20 hover:border-cyan-500/60 transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="text-xs font-bold" style={{ color: 'var(--neon-cyan)' }}>
              Containers
            </div>
          </Link>
          <Link
            href="/"
            className="card-vapor p-4 rounded-lg border border-purple-500/20 hover:border-pink-500/60 transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">🌸</div>
            <div className="text-xs font-bold" style={{ color: 'var(--neon-pink)' }}>
              Containers
            </div>
          </Link>
          <Link
            href="/databases"
            className="card-vapor p-4 rounded-lg border border-purple-500/20 hover:border-purple-500/60 transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">💾</div>
            <div className="text-xs font-bold" style={{ color: 'var(--neon-purple)' }}>
              Databases
            </div>
          </Link>
          <Link
            href="/server"
            className="card-vapor p-4 rounded-lg border border-purple-500/20 hover:border-green-500/60 transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">🖥️</div>
            <div className="text-xs font-bold" style={{ color: 'var(--neon-green)' }}>
              Server
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
