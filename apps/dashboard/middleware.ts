import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getAdminSessionFromRequest, isAuthEnabled } from './lib/auth-cookie';

export async function middleware(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const session = await getAdminSessionFromRequest(request);
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/media/:path*',
    '/playlists/:path*',
    '/schedule/:path*',
    '/devices/:path*',
  ],
};
