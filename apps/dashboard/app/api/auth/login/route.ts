import { NextResponse } from 'next/server';

import {
  adminSessionCookieName,
  adminSessionMaxAge,
  createAdminSessionCookie,
  getAdminEmail,
  getConfiguredAdminPassword,
  isAuthEnabled,
  shouldUseSecureCookie,
} from '../../../../lib/auth-cookie';

type LoginBody = {
  password?: unknown;
};

type AttemptRecord = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 60_000;

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  existing.count += 1;
  return existing.count <= MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }

  const ip = clientKey(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas tentativas. Tente novamente em alguns instantes.',
        },
      },
      { status: 429 },
    );
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

  if (!timingSafeEqualString(password, configuredPassword)) {
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

  attempts.delete(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: adminSessionCookieName,
    value: await createAdminSessionCookie(getAdminEmail()),
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: adminSessionMaxAge,
  });

  return response;
}
