import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll/SmoothScroll';
import { ToastProvider } from '@/components/Toast/ToastProvider';
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
  title: 'TARDIS Furniture — See it in your space',
  description:
    'Upload a furniture photo, generate a 3D model with AI, and place it in your room using AR. Works on iPhone (LiDAR) and Android.',
  keywords: [
    'AR furniture placement',
    'furniture 3D model',
    'view furniture in room',
    'AI interior design',
    'LiDAR furniture',
    'virtual furniture placement',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body style={{ fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
        <SmoothScroll />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
