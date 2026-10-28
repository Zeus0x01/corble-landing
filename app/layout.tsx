import './globals.css';
import './workspace.css';
import './login/login.css';
import type { Metadata, Viewport } from 'next';

const SITE_URL = 'https://corble.net';
const DESCRIPTION =
  'Corble builds practical websites and automation systems that help real businesses work smarter — results, not another tool to babysit.';
// Social previews truncate around ~125 characters, so shares get a shorter variant.
const SOCIAL_DESCRIPTION =
  'Corble builds practical websites and automation systems that help real businesses work smarter — results, not another tool.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Corble | Decisions, not dashboards.',
    template: '%s | Corble',
  },
  description: DESCRIPTION,
  keywords: [
    'business automation',
    'automation agency',
    'workflow automation',
    'WhatsApp automation',
    'lead follow-up automation',
    'AI agents for business',
    'business websites',
    'operations automation',
    'lead capture',
    'booking automation',
  ],
  applicationName: 'Corble',
  authors: [{ name: 'Corble' }],
  creator: 'Corble',
  publisher: 'Corble',
  category: 'technology',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Corble',
    locale: 'en_US',
    title: 'Corble | Decisions, not dashboards.',
    description: SOCIAL_DESCRIPTION,
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Corble — Decisions, not dashboards. Practical websites & automation systems.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Corble | Decisions, not dashboards.',
    description: SOCIAL_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c10',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
