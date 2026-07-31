'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type DashboardShellProps = {
  children: ReactNode;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: 'home' | 'media' | 'programming' | 'tv';
};

const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Início', icon: 'home' },
  { href: '/media', label: 'Conteúdos', icon: 'media' },
  { href: '/playlists', label: 'Programação', icon: 'programming' },
  { href: '/devices', label: 'TV', icon: 'tv' },
];

function isCurrentPath(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === '/playlists' && pathname.startsWith('/schedule'))
  );
}

function NavigationIcon({ icon }: { icon: NavigationItem['icon'] }) {
  if (icon === 'home') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9Z" />
      </svg>
    );
  }

  if (icon === 'media') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="18" x="3" y="4" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m5.5 17 4.2-4.2 3.1 3.1 2.2-2.2 3.5 3.3" />
      </svg>
    );
  }

  if (icon === 'programming') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="18" x="3" y="4" />
        <path d="M8 2v4M16 2v4M3 9h18M7 13h4M7 17h7" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="14" rx="2" width="18" x="3" y="4" />
      <path d="M8 22h8M12 18v4" />
    </svg>
  );
}

function Brand() {
  return (
    <Link className="brand-mark" href="/dashboard" aria-label="AquaFlora TV — Início">
      <span className="brand-symbol" aria-hidden="true">
        A
      </span>
      <span className="brand-copy">
        <strong>AquaFlora</strong>
        <small>TV da loja</small>
      </span>
    </Link>
  );
}

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={mobile ? 'mobile-nav-list' : 'nav-list'}
      aria-label={mobile ? 'Navegação móvel' : 'Navegação principal'}
    >
      {navigationItems.map((item) => {
        const isCurrent = isCurrentPath(pathname, item.href);

        return (
          <Link
            className={isCurrent ? 'nav-link is-active' : 'nav-link'}
            href={item.href}
            key={item.href}
            aria-current={isCurrent ? 'page' : undefined}
          >
            <NavigationIcon icon={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <Brand />
          <p className="sidebar-kicker">Painel da loja</p>
        </div>

        <NavigationLinks />

        <footer className="sidebar-footer">
          <div className="local-operation">
            <span aria-hidden="true" />
            <div>
              <strong>Operação local</strong>
              <small>Rede da AquaFlora</small>
            </div>
          </div>
          <a className="logout-link" href="/api/auth/logout">
            Sair do painel
          </a>
        </footer>
      </aside>

      <section className="dashboard-main">
        <header className="mobile-shell-header">
          <Brand />
          <a className="mobile-logout-link" href="/api/auth/logout">
            Sair
          </a>
        </header>
        <NavigationLinks mobile />

        <div className="workspace">{children}</div>
      </section>
    </main>
  );
}
