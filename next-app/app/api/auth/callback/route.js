import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, validateIdToken } from '../../../../lib/oauth.js';
import { getSession } from '../../../../lib/session.js';
import { requireEnv } from '../../../../lib/env.js';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'sqa_oauth_state';
const NONCE_COOKIE = 'sqa_oauth_nonce';

export async function GET(request) {
  const appUrl = requireEnv('APP_URL');
  const { searchParams } = new URL(request.url);

  // --- 1. Check for OAuth error response ---
  const oauthError = searchParams.get('error');
  if (oauthError) {
    const desc = searchParams.get('error_description') || oauthError;
    console.warn('[auth/callback] OAuth provider error:', desc);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(desc)}`);
  }

  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');

  if (!code || !returnedState) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_params`);
  }

  // --- 2. Validate CSRF state ---
  const cookieStore = cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  const storedNonce = cookieStore.get(NONCE_COOKIE)?.value;

  if (!storedState || !storedNonce) {
    console.warn('[auth/callback] Missing state/nonce cookies — session likely expired.');
    return NextResponse.redirect(`${appUrl}/login?error=session_expired`);
  }

  if (returnedState !== storedState) {
    console.warn('[auth/callback] State mismatch — possible CSRF attempt.');
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  // --- 3. Exchange code for tokens ---
  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (err) {
    console.error('[auth/callback] Token exchange error:', err.message);
    return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
  }

  // --- 4. Validate id_token (iss, aud, exp, nonce, email_verified, hd, email) ---
  let payload;
  try {
    payload = await validateIdToken(tokens.id_token, storedNonce);
  } catch (err) {
    console.warn('[auth/callback] Token validation failed:', err.message);
    // Use a user-friendly message for domain restriction
    const userMsg = err.message.includes('not allowed') || err.message.includes('not a @')
      ? 'access_denied_domain'
      : 'invalid_token';
    return NextResponse.redirect(`${appUrl}/login?error=${userMsg}`);
  }

  // --- 5. Write session ---
  // Persist via the cookies() store (reliable in App Router route handlers).
  const session = await getSession();
  session.user = {
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || null,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  await session.save();

  // --- 6. Clear the short-lived OAuth cookies ---
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NONCE_COOKIE);

  // Sign-in only happens to reach the gated instructor app, so land there.
  return NextResponse.redirect(`${appUrl}/instructor`);
}
