import { NextRequest, NextResponse } from 'next/server';
import { getSession, setDelegationCookie } from '@/lib/auth';
import { getUser, verifyPassword } from '@/lib/db';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientKey(request: NextRequest, username: string): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return `${ip}:${username}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return false;

  if (now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }
  entry.count += 1;
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest) {
  try {
    console.log('[LOGIN] Request received');
    const contentType = request.headers.get('content-type') || '';
    let username: string | null | undefined;
    let password: string | null | undefined;

    const expectsJson = contentType.includes('application/json');
    if (expectsJson) {
      const body = await request.json();
      username = body?.username;
      password = body?.password;
    } else {
      const form = await request.formData();
      username = form.get('username')?.toString();
      password = form.get('password')?.toString();
    }
    console.log('[LOGIN] Username:', username);
    const wantsHtml = request.headers.get('accept')?.includes('text/html');
    const shouldRedirect = !!wantsHtml && !expectsJson;
    const redirectToLogin = () => NextResponse.redirect(new URL('/login', request.url), 303);

    // Validate input
    if (!username || !password) {
      console.log('[LOGIN] Missing credentials');
      if (shouldRedirect) return redirectToLogin();
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const rateLimitKey = getClientKey(request, username);
    if (isRateLimited(rateLimitKey)) {
      if (shouldRedirect) return redirectToLogin();
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Get user from database
    console.log('[LOGIN] Looking up user:', username);
    const user = getUser(username);
    if (!user) {
      console.log('[LOGIN] User not found:', username);
      recordAttempt(rateLimitKey);
      if (shouldRedirect) return redirectToLogin();
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }
    console.log('[LOGIN] User found:', user.username, 'role:', user.role);

    // Verify password
    console.log('[LOGIN] Verifying password');
    if (!verifyPassword(user, password)) {
      console.log('[LOGIN] Password verification failed');
      recordAttempt(rateLimitKey);
      if (shouldRedirect) return redirectToLogin();
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }
    console.log('[LOGIN] Password verified successfully');

    // Create session
    console.log('[LOGIN] Creating session');
    const session = await getSession();
    session.user = {
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin === 1,
      role: user.role || (user.is_admin === 1 ? 'admin' : 'user'), // Fallback for migrated data
    };
    console.log('[LOGIN] Saving session');
    await session.save();
    clearAttempts(rateLimitKey);
    console.log('[LOGIN] Login successful for:', username);

    const response = shouldRedirect
      ? NextResponse.redirect(new URL('/', request.url), 303)
      : NextResponse.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin === 1,
          },
        });

    setDelegationCookie(response, session.user);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
