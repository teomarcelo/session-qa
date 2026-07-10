import { NextResponse } from 'next/server';
import { buildAuthUrl, generateRandom } from '../../../../lib/oauth.js';
import { validateEnv } from '../../../../lib/env.js';

export const dynamic = 'force-dynamic';

// Cookie names for CSRF state and nonce — short-lived, httpOnly
const STATE_COOKIE = 'sqa_oauth_state';
const NONCE_COOKIE = 'sqa_oauth_nonce';
const OAUTH_COOKIE_MAX_AGE = 10 * 60; // 10 minutes

export async function GET(request) {
  try {
    validateEnv();
  } catch (err) {
    console.error('[auth/login] env validation failed:', err.message);
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const state = generateRandom(32);
  const nonce = generateRandom(32);
  const authUrl = buildAuthUrl({ state, nonce });

  const response = NextResponse.redirect(authUrl);

  // Store state + nonce in short-lived httpOnly cookies for callback validation
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: '/',
  };
  response.cookies.set(STATE_COOKIE, state, cookieOpts);
  response.cookies.set(NONCE_COOKIE, nonce, cookieOpts);

  return response;
}
