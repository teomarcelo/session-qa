import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { requireEnv } from './env.js';

export const SESSION_COOKIE_NAME = 'sqa_session';

/** 8-hour session lifetime */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function getSessionOptions() {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: requireEnv('SESSION_SECRET'),
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    },
  };
}

/**
 * Returns the iron-session backed by Next's cookie store.
 * This is the reliable App Router pattern for route handlers and server
 * components: save()/destroy() persist through the cookies() store rather than
 * a NextResponse object (which does not reliably write the session cookie).
 */
export async function getSession() {
  return getIronSession(cookies(), getSessionOptions());
}

/**
 * Shape of the stored session data.
 * @typedef {{ email: string, name: string, picture: string | null, issuedAt: number }} SessionUser
 */
