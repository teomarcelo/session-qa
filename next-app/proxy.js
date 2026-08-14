import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';

const SESSION_COOKIE_NAME = 'sqa_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

// Only these prefixes require an authenticated ALLOWED_DOMAIN session.
// Everything else (/, /student, the OAuth API routes, static assets) is public
// so external students/attendees can join sessions without a Google login.
//
// Sign-in always lands back on /instructor (see api/auth/callback), so there is
// no post-login destination to carry through the redirect. If deeper instructor
// routes are added, thread the target through the OAuth state rather than a
// query param, so it cannot be pointed off-origin.
const PROTECTED_PREFIXES = ['/instructor'];

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Public by default — only gate the instructor surface.
  if (!isProtected(pathname)) return NextResponse.next();

  const loginRedirect = () => NextResponse.redirect(new URL('/login', request.url));

  // Both are needed to authorize a request. Missing config fails closed, which
  // also covers Vercel build/probe requests.
  const secret = process.env.SESSION_SECRET;
  const allowedDomain = process.env.ALLOWED_DOMAIN;
  if (!secret || !allowedDomain) return loginRedirect();

  // iron-session writes any re-sealed cookie onto the response it is handed, so
  // this exact object has to be the one returned on success. Returning a fresh
  // NextResponse.next() would silently drop the refreshed cookie and pin every
  // session to the original 8-hour expiry.
  const response = NextResponse.next();

  let session;
  try {
    session = await getIronSession(request, response, {
      cookieName: SESSION_COOKIE_NAME,
      password: secret,
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_SECONDS,
        path: '/',
      },
    });
  } catch {
    return loginRedirect();
  }

  // The domain is enforced when the session is minted (validateIdToken checks
  // the hd claim and the email suffix). Re-check it here so this gate does not
  // depend on that being the only way a session can ever come into existence.
  const email = String(session?.user?.email || '').toLowerCase();
  if (!email.endsWith(`@${allowedDomain.toLowerCase()}`)) return loginRedirect();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
