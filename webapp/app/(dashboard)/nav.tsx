'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { UserSession } from '@/types';
import { Lightning, Sparkle, Database, Package, HardDrives, Globe, Gear } from '@phosphor-icons/react';

export default function DashboardNav({ user }: { user: UserSession }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Hard redirect to ensure session is cleared
    window.location.href = '/login';
  };

  const isActive = (path: string) => pathname === path;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickOnButton = buttonRef.current && buttonRef.current.contains(target);
      const isClickOnDropdown = dropdownRef.current && dropdownRef.current.contains(target);

      if (!isClickOnButton && !isClickOnDropdown && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    // Prevent scrolling when dropdown is open
    if (isDropdownOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isDropdownOpen]);

  return (
    <nav className="card-vapor border-b-2 border-purple-500/30 relative overflow-visible z-[9999]">
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-pulse"></div>
      </div>
      
      <div className="px-4 sm:px-6 lg:px-8 relative">
        {/* Entire nav constrained to 1024px */}
        <div className="max-w-[1024px] mx-auto">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center flex-1">
              <div className="flex-shrink-0 flex items-center gap-2 group">
                <Lightning
                  size={34}
                  weight="duotone"
                  color="#00e863"
                  className="group-hover:scale-110 transition-transform"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(79, 214, 255, 0.6))' }}
                />
                <h1 className="text-4xl font-bold neon-text group-hover:scale-105 transition-transform" style={{ color: 'var(--neon-cyan)' }}>
                  DockLite
                </h1>
                <Sparkle
                  size={24}
                  weight="duotone"
                  color="#d90fd9"
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(255, 107, 214, 0.6))' }}
                />
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              <Link
                href="/"
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold transition-all relative overflow-hidden ${
                  isActive('/')
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-gray-900 neon-glow shadow-lg'
                    : 'text-cyan-300 hover:text-cyan-100 hover:bg-purple-900/30 hover:shadow-md'
                }`}
              >
                <Package size={20} weight="duotone" style={{ filter: 'drop-shadow(0 0 6px rgba(79, 214, 255, 0.4))' }} />
                <span>Containers</span>
                {isActive('/') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 animate-pulse rounded-xl"></div>
                )}
              </Link>
              <Link
                href="/databases"
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold transition-all relative overflow-hidden ${
                  isActive('/databases')
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-gray-900 neon-glow shadow-lg'
                    : 'text-cyan-300 hover:text-cyan-100 hover:bg-purple-900/30 hover:shadow-md'
                }`}
              >
                <Database size={20} weight="duotone" style={{ filter: 'drop-shadow(0 0 6px rgba(123, 92, 255, 0.4))' }} />
                <span>Databases</span>
                {isActive('/databases') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 animate-pulse rounded-xl"></div>
                )}
              </Link>
              <Link
                href="/backups"
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold transition-all relative overflow-hidden ${
                  isActive('/backups')
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-gray-900 neon-glow shadow-lg'
                    : 'text-cyan-300 hover:text-cyan-100 hover:bg-purple-900/30 hover:shadow-md'
                }`}
              >
                <HardDrives size={20} weight="duotone" style={{ filter: 'drop-shadow(0 0 6px rgba(107, 255, 176, 0.35))' }} />
                <span>Backups</span>
                {isActive('/backups') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 animate-pulse rounded-xl"></div>
                )}
              </Link>
              <Link
                href="/dns"
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold transition-all relative overflow-hidden ${
                  isActive('/dns')
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-gray-900 neon-glow shadow-lg'
                    : 'text-cyan-300 hover:text-cyan-100 hover:bg-purple-900/30 hover:shadow-md'
                }`}
              >
                <Globe size={20} weight="duotone" style={{ filter: 'drop-shadow(0 0 6px rgba(79, 214, 255, 0.4))' }} />
                <span>DNS</span>
                {isActive('/dns') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 animate-pulse rounded-xl"></div>
                )}
              </Link>
              <Link
                href="/server"
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-[15px] font-bold transition-all relative overflow-hidden ${
                  isActive('/server')
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-gray-900 neon-glow shadow-lg'
                    : 'text-cyan-300 hover:text-cyan-100 hover:bg-purple-900/30 hover:shadow-md'
                }`}
              >
                <Gear size={20} weight="duotone" style={{ filter: 'drop-shadow(0 0 6px rgba(123, 92, 255, 0.4))' }} />
                <span>Server</span>
                {isActive('/server') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 animate-pulse rounded-xl"></div>
                )}
              </Link>
            </div>
            </div>

            <div className="flex items-center gap-3">
            <div className="relative z-[10000] isolate" ref={dropdownRef}>
              <button
                ref={buttonRef}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center justify-center p-2 transition-all hover:scale-105 card-vapor rounded-xl border ${
                  isDropdownOpen
                    ? 'text-pink-100 border-pink-500/60 bg-pink-500/10'
                    : 'text-pink-300 hover:text-pink-100 border-pink-500/20 hover:border-pink-500/40'
                }`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xl relative" style={{ background: 'rgba(255, 16, 240, 0.2)' }}>
                  👤
                  {user.role === 'super_admin' ? (
                    <span className="absolute -top-1 -right-1 text-xs">👑✨</span>
                  ) : user.isAdmin ? (
                    <span className="absolute -top-1 -right-1 text-xs">👑</span>
                  ) : null}
                </div>
              </button>

              {isDropdownOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 w-64 bg-gradient-to-br from-purple-900 to-cyan-900 rounded-xl overflow-hidden border-2 border-pink-500 shadow-2xl"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    zIndex: 999999,
                  }}
                >
                  <div className="p-4 border-b border-purple-500/20">
                    <div className="font-bold text-cyan-300 flex items-center gap-2">
                      {user.username}
                      {user.role === 'super_admin' ? (
                        <span className="text-sm">👑✨</span>
                      ) : user.isAdmin ? (
                        <span className="text-sm">👑</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-purple-300 opacity-70">
                      {user.role === 'super_admin' ? 'Superadmin' : user.isAdmin ? 'Administrator' : 'User'}
                    </div>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-gradient-to-r hover:from-purple-900/50 hover:to-cyan-900/50 hover:text-cyan-100 transition-all group"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <span className="group-hover:scale-110 transition-transform">⚙️</span>
                      <span>Settings</span>
                    </Link>
                    {user.isAdmin && (
                      <Link
                        href="/settings/users"
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-cyan-300 hover:bg-gradient-to-r hover:from-purple-900/50 hover:to-cyan-900/50 hover:text-cyan-100 transition-all group"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <span className="group-hover:scale-110 transition-transform">👥</span>
                        <span>Users</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #ff6b6b 0%, var(--neon-pink) 100%)',
                color: 'white',
                boxShadow: '0 0 12px rgba(255, 16, 240, 0.4)'
              }}
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </nav>
  );
}
