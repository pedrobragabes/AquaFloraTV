import type { Metadata } from 'next';
import './globals.css';
import { appName, storeName } from '../lib/brand';

export const metadata: Metadata = {
  title: `${appName} — ${storeName}`,
  description: 'Controle local de conteúdos, playlists e programação para varejo',
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
