'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');

  const settingsSections = [
    {
      id: 'general',
      name: 'General',
      icon: '⚙️',
      description: 'System preferences and appearance',
      href: '/settings'
    },
    {
      id: 'password',
      name: 'Security',
      icon: '🔐',
      description: 'Change password and security settings',
      href: '/settings/password'
    },
    {
      id: 'users',
      name: 'Users',
      icon: '👥',
      description: 'Manage user accounts and permissions',
      href: '/settings/users'
    },
    {
      id: 'system',
      name: 'System',
      icon: '🖥️',
      description: 'Docker and system configuration',
      href: '/settings/system'
    },
    {
      id: 'appearance',
      name: 'Appearance',
      icon: '🎨',
      description: 'Theme and visual preferences',
      href: '/settings/appearance'
    }
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold neon-text mb-2" style={{ color: 'var(--neon-cyan)' }}>
            ⚙️ Settings
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            ▶ CONFIGURE YOUR DOCKLITE EXPERIENCE ◀
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsSections.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            className="card-vapor p-6 rounded-xl transition-all hover:scale-[1.02] hover:neon-glow group"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold neon-text mb-2" style={{ color: 'var(--neon-pink)' }}>
                  {section.name}
                </h3>
                <p className="text-sm font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                  {section.description}
                </p>
              </div>
              <div className="text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity">
                →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold neon-text mb-6" style={{ color: 'var(--neon-purple)' }}>
          ⚡ Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/settings/password"
            className="card-vapor p-4 rounded-lg text-center transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">🔐</div>
            <div className="text-sm font-bold">Change Password</div>
          </Link>
          <Link
            href="/settings/users"
            className="card-vapor p-4 rounded-lg text-center transition-all hover:scale-105"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="text-sm font-bold">Manage Users</div>
          </Link>
          <div className="card-vapor p-4 rounded-lg text-center transition-all hover:scale-105 opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-2">🎨</div>
            <div className="text-sm font-bold">Theme Settings</div>
            <div className="text-xs opacity-70 mt-1">Coming Soon</div>
          </div>
          <div className="card-vapor p-4 rounded-lg text-center transition-all hover:scale-105 opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm font-bold">System Stats</div>
            <div className="text-xs opacity-70 mt-1">Coming Soon</div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-12 card-vapor p-6 rounded-xl">
        <h3 className="text-xl font-bold neon-text mb-4" style={{ color: 'var(--neon-green)' }}>
          📊 System Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
              v1.0
            </div>
            <div className="text-xs font-mono opacity-70">Version</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-purple)' }}>
              🐳
            </div>
            <div className="text-xs font-mono opacity-70">Docker</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-pink)' }}>
              ⚡
            </div>
            <div className="text-xs font-mono opacity-70">Status</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-yellow)' }}>
              🔒
            </div>
            <div className="text-xs font-mono opacity-70">Secure</div>
          </div>
        </div>
      </div>
    </div>
  );
}