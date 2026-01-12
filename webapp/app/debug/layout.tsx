import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';

export default async function DebugLayout({ children }: { children: ReactNode }) {
  if (process.env.ENABLE_DEBUG_PAGES !== 'true') {
    notFound();
  }

  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  return <>{children}</>;
}
