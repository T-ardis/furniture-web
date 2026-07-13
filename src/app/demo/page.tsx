import type { Metadata } from 'next';
import Script from 'next/script';
import { getConfig } from '@/lib/config';
import { buildDemoModel, type ResolvedEmbed } from './model';
import styles from './demo.module.css';

export const metadata: Metadata = {
  title: 'Retailer demo — TARDIS embed',
  description:
    'A demonstration retailer product page running the real, installed TARDIS embed. One script tag adds “View in your room” AR to any storefront.',
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  const model = buildDemoModel(getConfig());

  return (
    <div className={styles.page}>
      <header className={styles.storeBar}>
        <span className={styles.storeName}>NORTHWIND HOME</span>
        <span className={styles.storeTag}>demonstration storefront</span>
      </header>

      <p className={styles.banner}>
        This page is a mock retailer product detail page. The{' '}
        <strong>View in your room</strong> button below is powered by the real
        TARDIS embed — the same single <code>&lt;script&gt;</code> a retailer
        drops onto their own site. Nothing here is a mockup of the AR itself.
      </p>

      {model.available ? (
        <Available embed={model.embed} />
      ) : (
        <Unavailable />
      )}
    </div>
  );
}

function Available({ embed }: { embed: ResolvedEmbed }) {
  return (
    <>
      <main className={styles.pdp}>
        <div className={styles.gallery}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/sofa.webp" alt="Halden three-seat sofa" className={styles.hero} />
        </div>

        <section className={styles.details}>
          <nav className={styles.breadcrumb}>Living room / Sofas / Halden</nav>
          <h1 className={styles.title}>Halden Three-Seat Sofa</h1>
          <p className={styles.price}>$1,499</p>
          <p className={styles.copy}>
            A low-profile, deep-seated sofa in stonewashed linen. Kiln-dried
            hardwood frame, feather-wrapped foam cushions, and solid oak legs.
          </p>

          <div className={styles.swatches} aria-hidden="true">
            <span className={styles.swatch} style={{ background: '#c8b9a6' }} />
            <span className={styles.swatch} style={{ background: '#6b6f6a' }} />
            <span className={styles.swatch} style={{ background: '#2f3336' }} />
          </div>

          <div className={styles.actions}>
            <button className={styles.addToCart} type="button">Add to cart</button>
            {/* Canonical TARDIS embed trigger (design §4). */}
            <button data-tardis data-product={embed.sampleProduct} data-mode="auto" className={styles.arButton}>
              View in your room
            </button>
          </div>

          <p className={styles.sku}>Product: {embed.sampleProduct}</p>
        </section>
      </main>

      {/*
        Canonical embed install (design §4): one deferred script that carries the
        publishable key + edge/collector URLs. Driven entirely by env config.
      */}
      <Script
        src={embed.widgetUrl}
        data-tardis-key={embed.key}
        data-tardis-api={embed.edgeUrl}
        data-tardis-collector={embed.collectorUrl}
        strategy="afterInteractive"
      />
    </>
  );
}

function Unavailable() {
  return (
    <main className={styles.unavailable}>
      <h1 className={styles.unavailableTitle}>Demo not configured</h1>
      <p className={styles.unavailableCopy}>
        This environment has not been given the live embed settings, so the demo
        cannot install the real widget. Rather than fake a product or call a
        local service, it stays disabled here.
      </p>
      <p className={styles.unavailableCopy}>
        Set the following environment variables to a real loader bundle, edge
        endpoint, collector endpoint, publishable key, and resolvable sample
        product SKU:
      </p>
      <ul className={styles.envList}>
        <li><code>NEXT_PUBLIC_TARDIS_WIDGET_URL</code></li>
        <li><code>NEXT_PUBLIC_TARDIS_EDGE_URL</code></li>
        <li><code>NEXT_PUBLIC_TARDIS_COLLECTOR_URL</code></li>
        <li><code>NEXT_PUBLIC_TARDIS_KEY</code></li>
        <li><code>NEXT_PUBLIC_TARDIS_SAMPLE_PRODUCT</code></li>
      </ul>
    </main>
  );
}
