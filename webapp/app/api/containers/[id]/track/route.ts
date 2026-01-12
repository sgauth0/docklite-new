import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { markContainerTracked } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(['admin', 'super_admin']);
    const containerId = params.id;

    if (!containerId) {
      return NextResponse.json({ error: 'Container ID is required' }, { status: 400 });
    }

    markContainerTracked(containerId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error tracking container:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
