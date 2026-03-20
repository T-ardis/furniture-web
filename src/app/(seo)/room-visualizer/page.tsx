import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav/Nav';
import Footer from '@/components/Footer/Footer';
import s from '../seo.module.css';

export const metadata: Metadata = {
  title: 'Furniture Room Visualizer — See How Furniture Looks in Your Room',
  description:
    'Free AI room visualizer. Upload a photo of your room and any furniture — see exactly how it looks in your space. Works with furniture from IKEA, Wayfair, Amazon, and any store.',
  keywords: [
    'furniture room visualizer',
    'see furniture in my room',
    'room visualizer online free',
    'virtual room designer furniture',
    'how to see furniture in your room before buying',
    'furniture try before you buy',
    'room design tool with my furniture',
    'AI room preview',
    'place furniture in room photo',
    'IKEA room visualizer alternative',
  ],
  alternates: { canonical: '/room-visualizer' },
  openGraph: {
    title: 'Furniture Room Visualizer — See How It Looks Before You Buy',
    description:
      'Upload your room photo + any furniture photo. AI shows you exactly how it looks in your space. Free, works with any store.',
    url: 'https://app.tardis-ai.com/room-visualizer',
  },
};

export default function RoomVisualizer() {
  return (
    <>
      <Nav />
      <main className={s.page}>
        <div className={s.container}>
          <span className={s.eyebrow}>Room Visualizer</span>
          <h1 className={s.h1}>
            See how furniture looks <em>in your room</em>
          </h1>
          <p className={s.subtitle}>
            Stop guessing. Upload a photo of your room and a photo of the furniture you&apos;re
            considering — TARDIS uses AI to show you exactly how it looks in your space. Works with
            furniture from any store.
          </p>

          <Link href="/" className={s.cta}>Try Room Visualizer →</Link>

          <section className={s.section}>
            <h2 className={s.h2}>How the room visualizer works</h2>
            <ol className={s.steps}>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>Upload your room photo</h3>
                  <p>
                    Take a photo of the room where you want to place the furniture. Any angle works
                    — living room, bedroom, office, dining room.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>Add the furniture</h3>
                  <p>
                    Upload or paste an image of the furniture piece you&apos;re considering. It can be
                    from any retailer — a screenshot, a catalog photo, or a product listing image.
                  </p>
                </div>
              </li>
              <li className={s.step}>
                <div className={s.stepContent}>
                  <h3>AI creates a preview</h3>
                  <p>
                    Our AI blends the furniture into your room photo with realistic lighting,
                    shadows, and perspective. See the result in seconds.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>More than just a mockup</h2>
            <p className={s.body}>
              TARDIS doesn&apos;t just paste the furniture image onto your room. Our AI understands
              room geometry, lighting conditions, and perspective to create a realistic composite
              that shows how the piece actually fits in your space.
            </p>
            <p className={s.body}>
              Combined with AR viewing, you can also place a full 3D model in your room using your
              phone camera for true spatial understanding — walk around it, see it from every angle,
              and verify the dimensions are right.
            </p>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>Works with any furniture, any store</h2>
            <p className={s.body}>
              Unlike store-specific tools that only show their own products, TARDIS works with
              furniture from <strong>any retailer</strong>: IKEA, Wayfair, West Elm, CB2, Article,
              Crate &amp; Barrel, Pottery Barn, Amazon, Target, and thousands more. You can even use
              photos of vintage or secondhand pieces.
            </p>
          </section>

          <section className={s.section}>
            <h2 className={s.h2}>Common questions</h2>
            <div className={s.faq}>
              <div className={s.faqItem}>
                <h3>How is this different from IKEA Place or other apps?</h3>
                <p>
                  Store-specific apps like IKEA Place only work with their own catalog. TARDIS works
                  with furniture from any store, any brand, any source — upload any photo and see it
                  in your room.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>How fast is the room preview?</h3>
                <p>
                  The AI room preview generates in 5–15 seconds. The full 3D model for AR viewing
                  takes 2–5 minutes.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>Can I try multiple furniture pieces in the same room?</h3>
                <p>
                  Yes. Generate previews for different pieces and compare how each one looks in your
                  space before making a decision.
                </p>
              </div>
              <div className={s.faqItem}>
                <h3>Does it work for any room type?</h3>
                <p>
                  Yes — living rooms, bedrooms, offices, dining rooms, kitchens, nurseries, and more.
                  Any interior space where you want to place furniture.
                </p>
              </div>
            </div>
          </section>

          <Link href="/" className={s.cta}>Visualize Furniture in Your Room →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
