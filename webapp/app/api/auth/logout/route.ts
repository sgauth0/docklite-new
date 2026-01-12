import { NextResponse } from 'next/server';
import { clearDelegationCookie, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    session.destroy();

    // Create response with cleared cookie
    const response = NextResponse.json({ success: true });

    // Force clear the session cookie
    response.cookies.set('docklite_session', '', {
      expires: new Date(0),
      path: '/',
    });
    clearDelegationCookie(response);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
