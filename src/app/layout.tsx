import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll/SmoothScroll';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { getWebsiteJsonLd, getApplicationJsonLd, getOrganizationJsonLd } from './jsonld';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: 'TARDIS — AI Furniture Visualizer | See Any Furniture in Your Room with AR',
    template: '%s | TARDIS Furniture',
  },
  description:
    'Upload a photo of any furniture and instantly generate a 3D model with AI. Place it in your room using AR on iPhone (LiDAR) or Android. Free online furniture visualizer — no app needed.',
  keywords: [
    'furniture visualizer',
    'AR furniture app',
    'see furniture in my room',
    'virtual furniture placement',
    'try furniture in room online',
    '3D furniture model generator',
    'AI room design tool',
    'augmented reality furniture',
    'place furniture in room AR',
    'furniture preview in room',
    'LiDAR furniture placement',
    'online furniture try before you buy',
    'IKEA furniture in my room',
    'sofa in room visualizer',
    'how to see furniture in your room before buying',
  ],
  metadataBase: new URL('https://app.tardis-ai.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'TARDIS — See Any Furniture in Your Room Before You Buy',
    description:
      'Upload a photo, get an AI-generated 3D model in seconds, and place it in your room using AR. Works on iPhone and Android — no app download needed.',
    url: 'https://app.tardis-ai.com',
    siteName: 'TARDIS',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'TARDIS — AI Furniture Visualizer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TARDIS — See Any Furniture in Your Room Before You Buy',
    description:
      'AI-powered furniture visualizer. Upload a photo → get a 3D model → place it in your room with AR. Free, no app needed.',
    images: ['/og.png'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getWebsiteJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getApplicationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getOrganizationJsonLd()) }}
        />
      </head>
      <body style={{ fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
        <SmoothScroll />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
