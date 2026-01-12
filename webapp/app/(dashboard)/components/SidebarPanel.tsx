'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import FileManager from './FileManager';
import SchemaBrowser from '../databases/SchemaBrowser';

type SidebarContent = 'stats' | 'logs' | 'database' | 'search' | 'none';

interface SidebarPanelProps {
  side: 'left' | 'right';
  defaultContent?: SidebarContent;
  mode?: 'file-browser' | 'modular';
  defaultOpen?: boolean;
  userSession?: { username: string; isAdmin: boolean } | null;
}

export default function SidebarPanel({
  side,
  defaultContent = 'none',
  mode = 'modular',
  defaultOpen = false,
  userSession = null,
}: SidebarPanelProps) {
  const isFileBrowser = mode === 'file-browser';
  const pathname = usePathname();
  const isDbEditMode = Boolean(pathname?.match(/^\/databases\/\d+\/edit/));
  const [selectedContent, setSelectedContent] = useState<SidebarContent>(defaultContent);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const contentOptions: Array<{ value: SidebarContent; label: string; icon: string }> = [
    { value: 'none', label: 'None', icon: '—' },
    { value: 'stats', label: 'Live Stats', icon: '📊' },
    { value: 'logs', label: 'Container Logs', icon: '📜' },
    { value: 'database', label: 'Database Query', icon: '💾' },
    { value: 'search', label: 'Search', icon: '🔍' },
  ];

  // Toggle button when sidebar is closed
  if (!isOpen || (!isFileBrowser && selectedContent === 'none')) {
    return (
      <button
        onClick={() => {
          if (!isFileBrowser && selectedContent === 'none') {
            const nextContent = defaultContent === 'none' ? 'stats' : defaultContent;
            setSelectedContent(nextContent);
          }
          setIsOpen(true);
        }}
        className={`fixed ${side === 'left' ? 'left-0' : 'right-0'} top-1/2 -translate-y-1/2 px-3 py-6 text-sm font-bold rounded-${side === 'left' ? 'r' : 'l'}-lg transition-all hover:scale-105 z-40`}
        style={{
          background: 'linear-gradient(135deg, var(--neon-purple) 0%, var(--neon-cyan) 100%)',
          color: 'white',
          boxShadow: '0 0 12px rgba(181, 55, 242, 0.4)',
          writingMode: 'vertical-rl',
        }}
        title={`Open ${side} sidebar`}
      >
        {side === 'left' ? '▶' : '◀'} {isDbEditMode ? 'Schema' : isFileBrowser ? 'Files' : 'Sidebar'}
      </button>
    );
  }

  return (
    <div className="relative">
      <div
        className={`fixed top-20 ${side === 'left' ? 'left-0' : 'right-0'} h-[calc(100vh-80px)] w-[20vw] bg-gradient-to-b from-purple-900/30 to-cyan-900/30 backdrop-blur-md border-${side === 'left' ? 'r' : 'l'} border-purple-500/20 flex flex-col z-40`}
      >
        {/* Header with selector only */}
        {!isFileBrowser && (
          <div className="p-4 border-b border-purple-500/20">
            <select
              value={selectedContent}
              onChange={(e) => setSelectedContent(e.target.value as SidebarContent)}
              className="input-vapor px-3 py-2 text-sm font-bold w-full"
              style={{
                background: 'rgba(15, 5, 30, 0.7)',
                border: '2px solid var(--neon-cyan)',
              }}
            >
              {contentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Content Area - simple padding, no notch */}
        <div className={`flex-1 overflow-auto ${isFileBrowser ? 'p-0' : 'p-4'}`}>
          {isFileBrowser && (isDbEditMode ? <SchemaBrowser /> : <FileManager embedded userSession={userSession} />)}
          {!isFileBrowser && selectedContent === 'stats' && <StatsContent />}
          {!isFileBrowser && selectedContent === 'logs' && <LogsContent />}
          {!isFileBrowser && selectedContent === 'database' && <DatabaseContent />}
          {!isFileBrowser && selectedContent === 'search' && <SearchContent />}
        </div>
      </div>

      {/* Vertical neon line on inner edge */}
      <div
        className={`fixed ${side === 'left' ? 'left-[20vw]' : 'right-[20vw]'} top-20 h-[calc(100vh-80px)] w-0.5 z-40`}
        style={{
          background: 'linear-gradient(180deg, var(--neon-pink) 0%, var(--neon-purple) 50%, var(--neon-cyan) 100%)',
          boxShadow: '0 0 8px rgba(255, 16, 240, 0.6)',
        }}
      />

      {/* Close button - on inner edge (toward main content), centered vertically */}
      <button
        onClick={() => setIsOpen(false)}
        className={`fixed ${side === 'left' ? 'left-[20vw]' : 'right-[20vw]'} top-1/2 -translate-y-1/2 ${side === 'left' ? '-translate-x-1/2' : 'translate-x-1/2'} px-2 py-4 text-sm font-bold rounded-lg transition-all hover:scale-110 z-50`}
        style={{
          background: 'linear-gradient(135deg, var(--neon-pink) 0%, var(--neon-purple) 100%)',
          color: 'white',
          boxShadow: '0 0 12px rgba(255, 16, 240, 0.6)',
        }}
        title="Close sidebar"
      >
        {side === 'left' ? '◀' : '▶'}
      </button>
    </div>
  );
}

// Placeholder components for each content type
function StatsContent() {
  return (
    <div className="text-sm font-mono">
      <div className="mb-4 text-cyan-300 font-bold">📊 Live Stats</div>
      <p className="text-xs opacity-70 mb-4">System metrics</p>
      <div className="space-y-4">
        <div className="card-vapor p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">CPU Usage</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--neon-green)' }}>24%</div>
        </div>
        <div className="card-vapor p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Memory</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--neon-cyan)' }}>3.2 GB</div>
        </div>
        <div className="card-vapor p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Containers</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--neon-pink)' }}>12</div>
        </div>
      </div>
    </div>
  );
}

function LogsContent() {
  return (
    <div className="text-sm font-mono">
      <div className="mb-4 text-cyan-300 font-bold">📜 Container Logs</div>
      <div className="bg-black/50 p-3 rounded-lg text-xs space-y-1 font-mono" style={{ color: 'var(--neon-green)' }}>
        <div>[2025-12-30 04:00:00] Container started</div>
        <div>[2025-12-30 04:00:01] Listening on port 80</div>
        <div>[2025-12-30 04:00:02] Ready to accept connections</div>
        <div className="opacity-50">...</div>
      </div>
    </div>
  );
}

function DatabaseContent() {
  return (
    <div className="text-sm font-mono">
      <div className="mb-4 text-cyan-300 font-bold">💾 Database Query</div>
      <textarea
        className="w-full h-32 p-2 rounded-lg text-xs font-mono mb-2"
        style={{
          background: 'rgba(15, 5, 30, 0.7)',
          border: '2px solid var(--neon-purple)',
          color: 'var(--text-primary)',
        }}
        placeholder="SELECT * FROM users;"
      />
      <button
        className="btn-neon w-full py-2 text-sm font-bold"
      >
        ▶ Execute Query
      </button>
    </div>
  );
}

function SearchContent() {
  return (
    <div className="text-sm font-mono">
      <div className="mb-4 text-cyan-300 font-bold">🔍 Search</div>
      <input
        type="text"
        className="input-vapor w-full px-3 py-2 text-sm mb-4"
        placeholder="Search containers, sites..."
        style={{
          background: 'rgba(15, 5, 30, 0.7)',
          border: '2px solid var(--neon-cyan)',
        }}
      />
      <div className="text-xs opacity-70">No results</div>
    </div>
  );
}
