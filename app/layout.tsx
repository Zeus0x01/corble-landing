import './globals.css';
import './workspace.css';
import './login/login.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Corble | Decisions, not dashboards.',
  description:
    'Corble builds practical websites and automation systems that help real businesses work smarter — results, not another tool to babysit.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
