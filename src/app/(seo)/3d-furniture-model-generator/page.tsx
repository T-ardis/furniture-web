import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav/Nav';
import Footer from '@/components/Footer/Footer';
import s from '../seo.module.css';

export const metadata: Metadata = {
  title: 'AI 3D Furniture Model Generator — Photo to 3D in Minutes',
  description:
    'Turn any furniture photo into a realistic 3D model using AI. Free online tool — upload a photo and get a USDZ or GLB model in 2–5 minutes. No 3D modeling skills needed.',
  keywords: [
    '3D furniture model generator',
    'photo to 3D model',
    'AI 3D model generator',
    'furniture 3D model from photo',
    'free 3D model generator',
    'USDZ furniture model',
    'GLB furniture model',
    'AI furniture modeling',
    'convert furniture photo to 3D',
    'generate 3D model online',
  ],
  alternates: { canonical: '/3d-furniture-model-generator' },
  openGraph: {
    title: 'AI 3D Furniture Model Generator — Photo to 3D in Minutes',
    description:
      'Upload any furniture photo and get a realistic 3D model in minutes. Free, AI-powered, no modeling skills needed.',
    url: 'https://app.tardis-ai.com/3d-furniture-model-generator',
  },
};

export default function ModelGenerator() {
  return (
    <>
      <Nav />
      <main className={s.page}>
        <div className={s.container}>
          <span className={s.eyebrow}>AI 3D Generation</span>
          <h1 className={s.h1}>
            Turn any furniture photo into a <em>3D model</em>
          </h1>
          <p className={s.subtitle}>
            TARDIS uses AI to generate realistic, to-scale 3D models from a single furniture photo.
            Get USDZ and GLB files in minutes — no 3D modeling experience required.
          </p>

          <Link href="/" className={s.cta}>Generate a 3D Model →</Link>

          <section className={s.section}>
            <h2 className={s.h2}>How AI 3D generation works</h2>
            <ol className={s.steps}>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>Upload a photo</h3>
                  <p>
                    Use any product photo — a screenshot from a retailer, a catalog image, or a
                    photo you took yourself. One angle is all the AI needs.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>Enter dimensions</h3>
                  <p>
                    Provide the width, height, and depth of the furniture piece so the 3D model is
                    generated at the correct real-world scale.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>AI generates the 3D model</h3>
                  <p>
                    Our AI reconstructs the furniture as a full 3D mesh in 2–5 minutes. The result
                    is a production-quality model with textures and proper geometry.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>View, download, or use in AR</h3>
                  <p>
                    Inspect the model in an interactive 3D viewer, place it in your room with AR,
                    or download the USDZ/GLB file for use in other applications.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>Output formats</h2>
            <p className={s.body}>
              <strong>USDZ:</strong> Apple&apos;s 3D format for AR Quick Look on iPhone and iPad.
              Drop it into Keynote, Pages, or use it in AR directly from Safari.
            </p>
            <p className={s.body}>
              <strong>GLB:</strong> Universal 3D format that works on Android (Scene Viewer),
              web browsers, Blender, Unity, Unreal Engine, and more.
            </p>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>What furniture can I convert?</h2>
            <p className={s.body}>
              TARDIS works with all types of furniture: sofas, chairs, tables, desks, beds, shelves,
              cabinets, dressers, nightstands, coffee tables, dining sets, and more. Any piece from
              any retailer — IKEA, Wayfair, West Elm, CB2, Article, Pottery Barn, Amazon, and
              independent stores.
            </p>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>FAQ</h2>
            <div className={s.faq}>
              <div className={s.faqItem}>
                <h3>How long does 3D model generation take?</h3>
                <p>
                  Typically 2–5 minutes depending on the complexity of the furniture piece. You can
                  watch the progress in real time.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>What photo quality do I need?</h3>
                <p>
                  A clear product photo from any angle works. Higher resolution gives better results,
                  but even a phone screenshot from a retailer website will produce a good model.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>Can I use the generated models commercially?</h3>
                <p>
                  Models generated with TARDIS are yours to use. They work great for e-commerce
                  listings, interior design presentations, and AR product experiences.
                </p>
              </div>
            </div>
          </section>

          <Link href="/" className={s.cta}>Generate Your First 3D Model →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
