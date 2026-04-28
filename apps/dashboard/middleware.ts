import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getAdminSessionFromRequest, isAuthEnabled } from './lib/auth-cookie';

const publicPrefixes = ['/login', '/api/auth', '/_next', '/favicon.ico'];

function isPublicPath(pathname: string): boolean {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  if (!isAuthEnabled() || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = await getAdminSessionFromRequest(request);
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
