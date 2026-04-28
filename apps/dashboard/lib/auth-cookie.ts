import type { NextRequest } from 'next/server';

export const adminSessionCookieName = 'aquatv_admin_session';

const sessionDurationSeconds = 12 * 60 * 60;

type AdminSession = {
  email: string;
  expiresAt: number;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeJson(value: AdminSession): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value: string): AdminSession | null {
  try {
    const json = new TextDecoder().decode(base64UrlDecode(value));
    const parsed = JSON.parse(json) as Partial<AdminSession>;

    if (typeof parsed.email !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }

    return {
      email: parsed.email,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function getSessionSecret(): string {
  return (
    process.env.DASHBOARD_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-session-secret'
  );
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));

  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

export function getAdminEmail(): string {
  const firstEmail =
    process.env.ADMIN_EMAILS?.split(',')
      .map((email) => email.trim())
      .find((email) => email.length > 0) ?? 'admin@aquatv.local';

  return firstEmail;
}

export function getConfiguredAdminPassword(): string | null {
  const configured = process.env.DASHBOARD_ADMIN_PASSWORD?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'aquatv-local';
  }

  return null;
}

export function isAuthEnabled(): boolean {
  return process.env.DASHBOARD_AUTH_ENABLED !== 'false';
}

export function shouldUseSecureCookie(request: Request): boolean {
  if (process.env.DASHBOARD_COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.DASHBOARD_COOKIE_SECURE === 'false') {
    return false;
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto) {
    return forwardedProto === 'https';
  }

  return new URL(request.url).protocol === 'https:';
}

export async function createAdminSessionCookie(email: string): Promise<string> {
  const payload = encodeJson({
    email,
    expiresAt: Date.now() + sessionDurationSeconds * 1000,
  });
  const signature = await sign(payload);

  return `${payload}.${signature}`;
}

export async function verifyAdminSessionCookie(
  value: string | undefined,
): Promise<AdminSession | null> {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await sign(payload);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const session = decodeJson(payload);
  if (!session || session.expiresAt <= Date.now()) {
    return null;
  }

  return session;
}

export async function getAdminSessionFromRequest(
  request: NextRequest,
): Promise<AdminSession | null> {
  return verifyAdminSessionCookie(request.cookies.get(adminSessionCookieName)?.value);
}

export const adminSessionMaxAge = sessionDurationSeconds;
