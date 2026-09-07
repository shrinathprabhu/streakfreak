import type { Metadata } from 'next';
import './globals.css';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata: Metadata = {
  title: 'Streakfreak — Small habits. Big you.',
  description:
    'Your private, local-only habit tracker. Build daily habits, watch your streaks grow, and take your data anywhere. No login, no subscriptions.',
  alternates: { canonical: 'https://lowkey.tools/streakfreak' },
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
