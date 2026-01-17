import { notFound } from 'next/navigation';
import { getAgentUser } from '@/lib/agent-auth';

export default async function DebugAuthPage() {
  if (process.env.ENABLE_DEBUG_PAGES !== 'true') {
    notFound();
  }

  const user = await getAgentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    notFound();
  }
  return (
    <div style={{ padding: '50px', fontFamily: 'monospace', background: '#000', color: '#0ff' }}>
      <h1>🔍 AUTH DEBUG</h1>
      <p>User: {user ? JSON.stringify(user) : 'null'}</p>
      <p>Status: {user ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}</p>
    </div>
  );
}
