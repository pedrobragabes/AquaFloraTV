import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AquaTV — AquaFlora Agroshop',
  description: 'Controle local de conteúdos, playlists e programação da AquaFlora Agroshop',
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
