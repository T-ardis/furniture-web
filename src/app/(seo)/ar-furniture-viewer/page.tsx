import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav/Nav';
import Footer from '@/components/Footer/Footer';
import s from '../seo.module.css';

export const metadata: Metadata = {
  title: 'AR Furniture Viewer Online — Place Any Furniture in Your Room',
  description:
    'Free augmented reality furniture viewer. Upload a photo of any furniture piece and place it in your room using AR on iPhone (LiDAR) or Android. No app download required.',
  keywords: [
    'AR furniture viewer',
    'augmented reality furniture',
    'place furniture in room AR',
    'furniture AR online',
    'see furniture in room before buying',
    'virtual furniture placement app',
    'LiDAR furniture viewer',
    'try furniture in my room',
  ],
  alternates: { canonical: '/ar-furniture-viewer' },
  openGraph: {
    title: 'AR Furniture Viewer — Place Any Furniture in Your Room',
    description:
      'Free online AR furniture viewer. See how any piece looks in your space before you buy.',
    url: 'https://app.tardis-ai.com/ar-furniture-viewer',
  },
};

export default function ArFurnitureViewer() {
  return (
    <>
      <Nav />
      <main className={s.page}>
        <div className={s.container}>
          <span className={s.eyebrow}>Augmented Reality</span>
          <h1 className={s.h1}>
            Place any furniture in your room <em>before you buy</em>
          </h1>
          <p className={s.subtitle}>
            TARDIS is a free AR furniture viewer that works in your browser. Upload a photo of any
            furniture — from any store — and see exactly how it looks and fits in your space using
            augmented reality.
          </p>

          <Link href="/" className={s.cta}>Try It Free →</Link>

          <section className={s.section}>
            <h2 className={s.h2}>How it works</h2>
            <ol className={s.steps}>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>Upload a furniture photo</h3>
                  <p>
                    Take a screenshot from any retailer — IKEA, Wayfair, West Elm, Amazon, or your
                    local furniture store. TARDIS works with any furniture image.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>AI generates a 3D model</h3>
                  <p>
                    Our AI analyzes the photo and creates a realistic, to-scale 3D model in 2–5
                    minutes. No manual modeling needed.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>View in AR on your phone</h3>
                  <p>
                    Point your phone camera at the floor and place the furniture in your room.
                    iPhone uses LiDAR for precise surface detection; Android uses ARCore.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>Works on every device</h2>
            <p className={s.body}>
              <strong>iPhone (Safari):</strong> Uses AR Quick Look with LiDAR scanning on iPhone 12
              Pro and later. Automatically detects surfaces and handles occlusion for realistic
              placement.
            </p>
            <p className={s.body}>
              <strong>Android (Chrome):</strong> Uses Google Scene Viewer with ARCore. Compatible
              with hundreds of Android devices from Samsung, Google Pixel, OnePlus, and more.
            </p>
            <p className={s.body}>
              <strong>Desktop:</strong> Full interactive 3D viewer with orbit, zoom, and pan
              controls. Perfect for inspecting the model before trying AR on your phone.
            </p>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>Frequently asked questions</h2>
            <div className={s.faq}>
              <div className={s.faqItem}>
                <h3>Do I need to download an app for AR furniture viewing?</h3>
                <p>
                  No. TARDIS works entirely in your browser. On iPhones and Android devices, the AR
                  experience launches directly from the web page.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>Does it work with furniture from any store?</h3>
                <p>
                  Yes. Upload a photo of furniture from IKEA, Wayfair, Amazon, West Elm, CB2,
                  Article, or any other retailer. Our AI works with any furniture image.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>How accurate is the AR placement?</h3>
                <p>
                  On iPhones with LiDAR (iPhone 12 Pro+), placement is extremely accurate with
                  real surface detection and object occlusion. On Android, ARCore provides reliable
                  plane detection for realistic placement.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>Is TARDIS free?</h3>
                <p>
                  Yes. Sign up with your email to generate 3D models and use the AR viewer for free.
                  No credit card required.
                </p>
              </div>
            </div>
          </section>

          <Link href="/" className={s.cta}>Try AR Furniture Viewer →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
