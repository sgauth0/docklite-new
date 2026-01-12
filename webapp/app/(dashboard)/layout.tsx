import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DashboardNav from './nav';
import SidebarPanel from './components/SidebarPanel';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen retro-grid scanlines">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      </div>

      <DashboardNav user={user} />

      {/* Customizable Sidebars - Overlay style, don't push content */}
      <SidebarPanel side="left" mode="file-browser" defaultOpen userSession={user} />
      <SidebarPanel side="right" mode="modular" defaultContent="none" />

      {/* Main content area - keeps existing width */}
      <main className="p-8 relative z-10">
        {children}
      </main>

      {/* Footer with system info */}
      <footer className="fixed bottom-4 right-4 text-xs font-mono opacity-40 hover:opacity-70 transition-opacity z-50">
        <div className="card-vapor px-3 py-2 rounded-lg">
          <div style={{ color: 'var(--neon-cyan)' }}>DockLite v1.0</div>
          <div style={{ color: 'var(--text-secondary)' }}>System Ready</div>
        </div>
      </footer>
    </div>
  );
}
