import type { Metadata } from 'next';
import localFont from 'next/font/local';
import site from '@/lib/site-content.json';
import './globals.css';
const geistSans = localFont({
  src: './fonts/GeistVariable.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  style: 'normal',
  // Keep a slow font response from replacing already-visible text mid-session.
  display: 'optional',
  preload: true,
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});
export const metadata: Metadata = {
  // Absolute SEO URLs preserve the canonical root slash without base normalization.
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
    siteName: site.name,
    locale: 'en_US',
    images: [
      {
        url: new URL('og-image.png', site.canonical).href,
        width: 1734,
        height: 907,
        alt: 'Streakfreak — Private habits. Lasting streaks. by @shrinath_prabhu',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@shrinath_prabhu',
    title: site.title,
    description: site.description,
    images: [new URL('og-image.png', site.canonical).href],
  },
  applicationName: 'Streakfreak',
  authors: [{ name: 'Shrinath Prabhu', url: 'https://shrinath.me' }],
  creator: 'Shrinath Prabhu',
  publisher: 'OwlEye Analytics',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/icons/apple-touch-icon.png',
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
    <html lang="en" className={geistSans.variable}>
      <body>
        {children}
        <noscript>
          <div style={{ padding: '30px' }}>
            Streakfreak needs JavaScript to save your habits locally. Enable
            JavaScript in this browser to get started.
          </div>
        </noscript>
      </body>
    </html>
  );
}
