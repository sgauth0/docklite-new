import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies, headers } from 'next/headers';
import { UserSession } from '@/types';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line no-var
  var __dockliteDevSessionSecret: string | undefined;
}

function getSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const isValidLength = typeof secret === 'string' && secret.length >= 32;

  if (secret && isValidLength) return secret;

  if (isProd) {
    if (!secret) {
      throw new Error('SESSION_SECRET is required in production.');
    }
    throw new Error('SESSION_SECRET must be at least 32 characters long in production.');
  }

  if (secret) {
    console.warn('⚠️ SESSION_SECRET is too short. Deriving a dev-only secret.');
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  console.warn('⚠️ SESSION_SECRET is not set. Using a temporary dev-only secret.');
  if (!globalThis.__dockliteDevSessionSecret) {
    globalThis.__dockliteDevSessionSecret = `dev_${crypto.randomBytes(24).toString('hex')}`;
  }
  return globalThis.__dockliteDevSessionSecret;
}

// Session configuration
function shouldUseSecureCookies(): boolean {
  if (process.env.DOCKLITE_INSECURE_COOKIES === 'true') return false;
  if (process.env.NODE_ENV !== 'production') return false;

  try {
    const proto = headers().get('x-forwarded-proto');
    if (proto) {
      return proto.split(',')[0]?.trim() === 'https';
    }
  } catch {
    // Fall through to production default if headers are unavailable.
  }

  return true;
}

function getSessionOptions(): SessionOptions {
  return {
    password: getSessionPassword(),
    cookieName: 'docklite_session',
    cookieOptions: {
      secure: shouldUseSecureCookies(),
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  };
}

const delegationCookieName = 'docklite_delegation';
const delegationTtlSeconds = 60 * 60 * 24;

function getDelegationSecret(): string | null {
  return process.env.AGENT_TOKEN || process.env.DOCKLITE_TOKEN || null;
}

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString('base64url');
}

function createDelegationToken(user: UserSession): string | null {
  const secret = getDelegationSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.userId,
    role: user.role,
    admin: user.isAdmin,
    iat: now,
    exp: now + delegationTtlSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function setDelegationCookie(response: { cookies: { set: Function } }, user: UserSession | null | undefined) {
  if (!user) return;
  const token = createDelegationToken(user);
  if (!token) return;
  response.cookies.set(delegationCookieName, token, {
    secure: shouldUseSecureCookies(),
    httpOnly: true,
    sameSite: 'lax',
    maxAge: delegationTtlSeconds,
    path: '/',
  });
}

export function clearDelegationCookie(response: { cookies: { set: Function } }) {
  response.cookies.set(delegationCookieName, '', {
    expires: new Date(0),
    path: '/',
  });
}

// Extend IronSession type
export interface SessionData {
  user?: UserSession;
}

// Get session from cookies
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session.user;
}

// Get current user from session
export async function getCurrentUser(): Promise<UserSession | null> {
  const session = await getSession();
  if (!session.user) return null;

  const { getUserById } = await import('./db');
  const dbUser = getUserById(session.user.userId);
  if (!dbUser) return null;

  session.user.role = dbUser.role || (dbUser.is_admin ? 'admin' : 'user');
  session.user.isAdmin = dbUser.is_admin === 1;
  session.user.username = dbUser.username;

  return session.user;
}

// Require authentication (throws if not authenticated)
export async function requireAuth(): Promise<UserSession> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// Require admin (throws if not admin)
export async function requireAdmin(): Promise<UserSession> {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}

// Check if user has specific role (new role-based auth)
export async function requireRole(allowedRoles: Array<'super_admin' | 'admin' | 'user'>): Promise<UserSession> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: Requires one of: ${allowedRoles.join(', ')}`);
  }
  return user;
}

// Require super admin only
export async function requireSuperAdmin(): Promise<UserSession> {
  return requireRole(['super_admin']);
}

// Check if user can manage another user (hierarchy check)
export async function canManageUser(managerId: number, targetUserId: number): Promise<boolean> {
  const { getUserById } = await import('./db');
  const manager = getUserById(managerId);
  const target = getUserById(targetUserId);

  if (!manager || !target) return false;

  // Super admin can manage anyone
  if (manager.is_super_admin === 1) return true;

  // Admin can manage regular users (not other admins)
  if (manager.role === 'admin' && target.role === 'user') return true;

  // Admin can manage users they created
  if (manager.role === 'admin' && target.managed_by === managerId) return true;

  return false;
}
