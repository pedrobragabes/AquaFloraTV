import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getAdminSessionFromRequest, isAuthEnabled } from '../../../../lib/auth-cookie';

function getApiBaseUrl(): string {
  const internal = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!internal) {
    throw new Error('API_INTERNAL_URL ou NEXT_PUBLIC_API_URL precisa ser configurado');
  }
  return internal.replace(/\/$/, '');
}

function getAdminToken(): string | null {
  const token = process.env.API_ADMIN_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function ensureAuthenticated(request: NextRequest): Promise<NextResponse | null> {
  if (!isAuthEnabled()) {
    return null;
  }
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sessão admin necessária' } },
      { status: 401 },
    );
  }
  return null;
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const blocked = await ensureAuthenticated(request);
  if (blocked) {
    return blocked;
  }

  const adminToken = getAdminToken();
  if (!adminToken) {
    return NextResponse.json(
      {
        error: {
          code: 'PROXY_NOT_CONFIGURED',
          message: 'API_ADMIN_TOKEN não configurado no dashboard.',
        },
      },
      { status: 503 },
    );
  }

  let baseUrl: string;
  try {
    baseUrl = getApiBaseUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API base URL inválida';
    return NextResponse.json({ error: { code: 'PROXY_NOT_CONFIGURED', message } }, { status: 503 });
  }

  const params = await context.params;
  const pathSegments = params.path ?? [];
  const pathname =
    pathSegments.length > 0 ? `/${pathSegments.map(encodeURIComponent).join('/')}` : '';
  const search = request.nextUrl.search;
  const upstreamUrl = `${baseUrl}${pathname}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  if (!headers.has('authorization')) {
    headers.set('authorization', `Bearer ${adminToken}`);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    redirect: 'manual',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body;
    (init as RequestInit & { duplex?: string }).duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao contatar API';
    return NextResponse.json({ error: { code: 'PROXY_UPSTREAM_ERROR', message } }, { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
