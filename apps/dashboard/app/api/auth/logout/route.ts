import { NextResponse } from 'next/server';

import { adminSessionCookieName, shouldUseSecureCookie } from '../../../../lib/auth-cookie';

function buildLogoutResponse(request: Request, redirect: boolean): NextResponse {
  const response = redirect
    ? NextResponse.redirect(new URL('/login', request.url))
    : NextResponse.json({ ok: true });

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

export function POST(request: Request) {
  return buildLogoutResponse(request, false);
}

export function GET(request: Request) {
  return buildLogoutResponse(request, true);
}
