import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AquaTV Dashboard',
  description: 'Controle de playlists e devices da Aquaflora',
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
