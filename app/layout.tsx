import './globals.css';
import './workspace.css';
import './login/login.css';
import type { Metadata, Viewport } from 'next';

const SITE_URL = 'https://corble.net';
const DESCRIPTION =
  'Corble builds intelligent business automation backed by cybersecurity expertise, helping businesses streamline operations without overlooking security.';
// Social previews truncate around ~125 characters, so shares get a shorter variant.
const SOCIAL_DESCRIPTION =
  'Secure business automation powered by cybersecurity expertise.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Corble | Automate Smarter. Secure by Design.',
    template: '%s | Corble',
  },
  description: DESCRIPTION,
  keywords: [
    'business automation',
    'secure business automation',
    'workflow automation',
    'security-driven engineering',
    'secure workflow architecture',
    'intelligent workflow engineering',
    'reliable system integrations',
    'security-conscious development',
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
    title: 'Corble | Automate Smarter. Secure by Design.',
    description: SOCIAL_DESCRIPTION,
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Corble — Automate Smarter. Secure by Design.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Corble | Automate Smarter. Secure by Design.',
    description: SOCIAL_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
  verification: {
    google: '6MvyV5y8mJTZqA7UI-TXxnq-XoMcnWwDD14zUwb0BGY',
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
