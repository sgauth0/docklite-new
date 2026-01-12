
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSslStatus } from '@/lib/traefik';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
    const sslStatus = await getSslStatus();
    return NextResponse.json({ sslStatus });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting SSL status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
