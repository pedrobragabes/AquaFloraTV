export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined' || !window.location.hostname) {
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:7741';
  }

  return `${window.location.protocol}//${window.location.hostname}:7741`;
}
