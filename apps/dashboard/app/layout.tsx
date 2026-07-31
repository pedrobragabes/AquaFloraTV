import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AquaFlora TV',
  description: 'Controle de conteúdos e programação da TV da AquaFlora',
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
