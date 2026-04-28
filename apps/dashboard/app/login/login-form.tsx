'use client';

import { useMemo, useState } from 'react';

function resolveNextPath(): string {
  if (typeof window === 'undefined') {
    return '/media';
  }

  const nextPath = new URLSearchParams(window.location.search).get('next');
  if (nextPath?.startsWith('/')) {
    return nextPath;
  }

  return '/media';
}

export function LoginForm() {
  const nextPath = useMemo(resolveNextPath, []);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? `Login falhou (${response.status})`);
      }

      window.location.assign(nextPath);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Falha ao entrar';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Acesso local</p>
          <h1>AquaTV</h1>
        </div>

        <form className="login-form" onSubmit={(event) => void submitLogin(event)}>
          <label htmlFor="admin-password">Senha do painel</label>
          <input
            autoComplete="current-password"
            autoFocus
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? <p className="error-banner">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting || !password}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
