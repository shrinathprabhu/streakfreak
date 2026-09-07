import type { Metadata } from 'next';
import site from '@/lib/site-content.json';
import './globals.css';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata: Metadata = {
  metadataBase: new URL(site.canonical),
  title: site.title,
  description: site.description,
  alternates: { canonical: site.canonical },
  category: 'productivity',
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  openGraph: {
    type: 'website',
    url: site.canonical,
    title: site.title,
    description: site.description,
    siteName: 'Streakfreak · Lowkey Tools',
    locale: 'en_US',
    images: [
      {
        url: `${site.canonical}/icons/icon-512.png`,
        width: 512,
        height: 512,
        alt: 'Streakfreak orange flame app icon',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: site.title,
    description: site.description,
    images: [`${site.canonical}/icons/icon-512.png`],
  },
  applicationName: 'Streakfreak',
  authors: [{ name: 'Shrinath Prabhu', url: 'https://shrinath.me' }],
  creator: 'Shrinath Prabhu',
  publisher: 'OwlEye Analytics',
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${base}/favicon.svg`, type: 'image/svg+xml' }],
    apple: `${base}/icons/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Streakfreak',
  },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#df541f',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <noscript>
          <div style={{ padding: '30px', fontFamily: 'sans-serif' }}>
            Streakfreak needs JavaScript to save your habits locally. Enable
            JavaScript in this browser to get started.
          </div>
        </noscript>
      </body>
    </html>
  );
}
