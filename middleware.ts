import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'authjs.session-token';
const SESSION_COOKIE_SECURE = '__Secure-authjs.session-token';

// Edge-safe guard: authenticated users carry a session cookie.
// Full JWT verification + role checks happen in the /workspace layout via auth().
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has(SESSION_COOKIE) ||
    req.cookies.has(SESSION_COOKIE_SECURE) ||
    req.cookies.has('next-auth.session-token');

  if (!hasSession) {
    const url = new URL('/login', req.url);
    url.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/workspace/:path*'],
};
