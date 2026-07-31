export function normalizeApiUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const explicitProtocol = trimmed.match(/^([a-z][a-z\d+.-]*):\/\//i)?.[1]?.toLowerCase();
  if (explicitProtocol && explicitProtocol !== 'http' && explicitProtocol !== 'https') {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }

    const pathname = url.pathname.replace(/\/+$/, '');
    url.pathname = pathname.endsWith('/api') ? pathname : `${pathname}/api`;
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
