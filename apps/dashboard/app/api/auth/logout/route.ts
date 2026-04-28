import { NextResponse } from 'next/server';

import { adminSessionCookieName, shouldUseSecureCookie } from '../../../../lib/auth-cookie';

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set({
    name: adminSessionCookieName,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: 0,
  });

  return response;
}
