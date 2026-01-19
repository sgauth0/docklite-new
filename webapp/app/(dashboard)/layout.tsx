import { redirect } from 'next/navigation';
import { getAgentUser } from '@/lib/agent-auth';
import DashboardShell from './components/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAgentUser();

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

      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </div>
  );
}
