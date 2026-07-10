import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';

const SESSION_COOKIE_NAME = 'sqa_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

// Only these prefixes require an authenticated @salesforce.com session.
// Everything else (/, /student, the OAuth API routes, static assets) is public
// so external students/attendees can join sessions without a Google login.
const PROTECTED_PREFIXES = ['/instructor'];

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public by default — only gate the instructor surface.
  if (!isProtected(pathname)) return NextResponse.next();

  // Read session cookie; we need the SESSION_SECRET at runtime here
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed during Vercel build/probe — redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  let session;
  try {
    // iron-session needs a writable response to potentially refresh the cookie
    const response = NextResponse.next();
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
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!session?.user?.email) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
