import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getAgentUser } from '@/lib/agent-auth';

export default async function DebugLayout({ children }: { children: ReactNode }) {
  if (process.env.ENABLE_DEBUG_PAGES !== 'true') {
    notFound();
  }

  const user = await getAgentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    notFound();
  }

  return <>{children}</>;
}
