import { NextResponse } from 'next/server';

import {
  adminSessionCookieName,
  adminSessionMaxAge,
  createAdminSessionCookie,
  getAdminEmail,
  getConfiguredAdminPassword,
  isAuthEnabled,
} from '../../../../lib/auth-cookie';

type LoginBody = {
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }

  const configuredPassword = getConfiguredAdminPassword();
  if (!configuredPassword) {
    return NextResponse.json(
      {
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'DASHBOARD_ADMIN_PASSWORD precisa ser configurado.',
        },
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const password = typeof body.password === 'string' ? body.password : '';

  if (password !== configuredPassword) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Senha inválida.',
        },
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: adminSessionCookieName,
    value: await createAdminSessionCookie(getAdminEmail()),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: adminSessionMaxAge,
  });

  return response;
}
