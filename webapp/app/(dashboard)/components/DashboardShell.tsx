'use client';

import DashboardNav from '../nav';
import SidebarPanel from './SidebarPanel';
import { UserSession } from '@/types';

type DashboardShellProps = {
  user: UserSession;
  children: React.ReactNode;
};

export default function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <>
      <DashboardNav user={user} />

      <SidebarPanel side="left" mode="file-browser" defaultOpen userSession={user} />
      <SidebarPanel side="right" mode="modular" defaultContent="none" />

      <main className="p-8 relative z-10">
        {children}
      </main>

      <footer className="fixed bottom-4 right-4 text-xs font-mono opacity-40 hover:opacity-70 transition-opacity z-50">
        <div className="card-vapor px-3 py-2 rounded-lg">
          <div style={{ color: 'var(--neon-cyan)' }}>DockLite v1.0</div>
          <div style={{ color: 'var(--text-secondary)' }}>System Ready</div>
        </div>
      </footer>
    </>
  );
}
