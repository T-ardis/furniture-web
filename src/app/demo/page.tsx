import type { Metadata } from 'next';
import Script from 'next/script';
import { getConfig } from '@/lib/config';
import { buildDemoModel, type ResolvedEmbed } from './model';
import { QtyStepper } from './qty-stepper';
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
        <nav className={styles.storeNav} aria-label="Primary">
          <span>Sofas</span>
          <span>Seating</span>
          <span>Tables</span>
          <span>Lighting</span>
        </nav>
      </header>

      <p className={styles.banner}>
        This is a mock retailer product page. The{' '}
        <strong>View in your room</strong> button (3D&nbsp;+&nbsp;native AR) below is
        powered by the real TARDIS embed — the same single{' '}
        <code>&lt;script&gt;</code> a retailer drops onto their own site. Nothing here
        is a mockup of the AR itself.
      </p>

      {model.available ? <Available embed={model.embed} /> : <Unavailable />}
    </div>
  );
}

function Available({ embed }: { embed: ResolvedEmbed }) {
  return (
    <>
      <main>
        {/* ── Halden sofa — 3D + native AR ──────────────────────────── */}
        <section className={styles.product} aria-label="Halden Three-Seat Sofa">
          <div className={styles.pdp}>
            <div className={styles.gallery}>
              <figure className={styles.stage}>
                <span className={styles.saveBadge}>Save 14%</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/demo/sofa.webp"
                  alt="Halden three-seat sofa in stonewashed oat linen"
                  className={styles.hero}
                />
                <span className={styles.stageHint}>◱ View in your room</span>
              </figure>
              <div className={styles.thumbRail} aria-hidden="true">
                <span className={styles.thumb} style={{ objectPosition: '50% 50%' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/demo/sofa.webp" alt="" className={styles.thumbImg} />
                </span>
                <span className={styles.thumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/demo/sofa.webp"
                    alt=""
                    className={styles.thumbImg}
                    style={{ transform: 'scale(1.9)', objectPosition: '20% 60%' }}
                  />
                </span>
                <span className={styles.thumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/demo/sofa.webp"
                    alt=""
                    className={styles.thumbImg}
                    style={{ transform: 'scale(2.2)', objectPosition: '80% 45%' }}
                  />
                </span>
              </div>
            </div>

            <section className={styles.details}>
              <nav className={styles.breadcrumb}>Living room / Sofas / Halden</nav>
              <p className={styles.eyebrow}>The Halden Collection</p>
              <h1 className={styles.title}>Halden Three-Seat Sofa</h1>

              <div className={styles.rating}>
                <span className={styles.stars} aria-hidden="true">
                  ★★★★★
                </span>
                <span className={styles.ratingText}>4.8 · 312 reviews</span>
              </div>

              <div className={styles.price}>
                <span className={styles.priceNow}>$1,499</span>
                <span className={styles.priceWas}>$1,749</span>
                <span className={styles.priceOff}>Save $250</span>
              </div>

              <p className={styles.copy}>
                A low-profile, deep-seated sofa in stonewashed linen. Kiln-dried
                hardwood frame, feather-wrapped foam cushions, and solid oak legs.
                Tool-free assembly in under twenty minutes.
              </p>

              <div className={styles.opt}>
                <div className={styles.optHead}>
                  <span className={styles.optKey}>Fabric</span>
                  <span className={styles.optVal}>
                    <span className="fn-oat">Oat Linen</span>
                    <span className="fn-sage">Sage Weave</span>
                    <span className="fn-slate">Slate Twill</span>
                  </span>
                </div>
                <div className={styles.swatches}>
                  <input
                    className={styles.vhInput}
                    type="radio"
                    name="fabric"
                    id="fab-oat"
                    defaultChecked
                  />
                  <label
                    className={styles.swatch}
                    htmlFor="fab-oat"
                    style={{ background: '#c8b9a6' }}
                    aria-label="Oat Linen"
                  />
                  <input className={styles.vhInput} type="radio" name="fabric" id="fab-sage" />
                  <label
                    className={styles.swatch}
                    htmlFor="fab-sage"
                    style={{ background: '#6b6f6a' }}
                    aria-label="Sage Weave"
                  />
                  <input className={styles.vhInput} type="radio" name="fabric" id="fab-slate" />
                  <label
                    className={styles.swatch}
                    htmlFor="fab-slate"
                    style={{ background: '#2f3336' }}
                    aria-label="Slate Twill"
                  />
                </div>
              </div>

              <div className={styles.buyRow}>
                <QtyStepper />
                <button className={styles.addToCart} type="button">
                  Add to cart
                </button>
              </div>

              {/* Canonical TARDIS embed trigger (design §4). */}
              <button data-tardis data-product={embed.sampleProduct} data-mode="auto" className={styles.arButton}>
                View in your room
              </button>

              <ul className={styles.assurances}>
                <li>Free white-glove delivery, assembled in the room of your choice.</li>
                <li>100-night home trial with free returns.</li>
                <li>10-year kiln-dried hardwood frame warranty.</li>
              </ul>

              <div className={styles.accordions}>
                <details className={styles.acc} open>
                  <summary className={styles.accSummary}>
                    Details <span className={styles.plus}>+</span>
                  </summary>
                  <div className={styles.accBody}>
                    The Halden pairs a low, mid-century profile with genuinely deep
                    seats. Back cushions are a feather-and-fibre blend; seat cushions
                    are high-resilience foam wrapped in fibre for a soft-but-supportive
                    sit.
                  </div>
                </details>
                <details className={styles.acc}>
                  <summary className={styles.accSummary}>
                    Dimensions <span className={styles.plus}>+</span>
                  </summary>
                  <div className={styles.accBody}>
                    <dl className={styles.specs}>
                      <div className={styles.spec}>
                        <dt>Overall width</dt>
                        <dd>218 cm / 86″</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Depth</dt>
                        <dd>98 cm / 39″</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Height</dt>
                        <dd>84 cm / 33″</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Seat height</dt>
                        <dd>46 cm / 18″</dd>
                      </div>
                    </dl>
                  </div>
                </details>
                <details className={styles.acc}>
                  <summary className={styles.accSummary}>
                    Materials &amp; care <span className={styles.plus}>+</span>
                  </summary>
                  <div className={styles.accBody}>
                    Stonewashed linen blend with a stain-resistant finish. Removable,
                    dry-clean-friendly covers. Spot clean with mild detergent.
                  </div>
                </details>
              </div>

              <p className={styles.sku}>Product: {embed.sampleProduct}</p>
            </section>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footBrand}>
          <span className={styles.storeName}>NORTHWIND HOME</span>
          <p className={styles.footNote}>
            Considered furniture for real rooms. This is a demonstration
            storefront — the Halden sofa above installs the real TARDIS embed.
          </p>
        </div>
        <div className={styles.footCols}>
          <div className={styles.footCol}>
            <h4>Shop</h4>
            <span>Sofas</span>
            <span>Tables</span>
            <span>Lighting</span>
          </div>
          <div className={styles.footCol}>
            <h4>Help</h4>
            <span>Delivery</span>
            <span>Returns</span>
            <span>Warranty</span>
          </div>
          <div className={styles.footCol}>
            <h4>Company</h4>
            <span>About</span>
            <span>Showrooms</span>
            <span>Sustainability</span>
          </div>
        </div>
      </footer>

      {/*
        Canonical embed install (design §4): one deferred script that carries the
        publishable key + edge/collector URLs. Driven entirely by env config. It
        auto-scans the trigger above.
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
        cannot install the real widget. Rather than fake a product or call a local
        service, it stays disabled here.
      </p>
      <p className={styles.unavailableCopy}>
        Set the following environment variables to a real loader bundle, edge
        endpoint, collector endpoint, publishable key, and resolvable sample product
        SKU:
      </p>
      <ul className={styles.envList}>
        <li>
          <code>NEXT_PUBLIC_TARDIS_WIDGET_URL</code>
        </li>
        <li>
          <code>NEXT_PUBLIC_TARDIS_EDGE_URL</code>
        </li>
        <li>
          <code>NEXT_PUBLIC_TARDIS_COLLECTOR_URL</code>
        </li>
        <li>
          <code>NEXT_PUBLIC_TARDIS_KEY</code>
        </li>
        <li>
          <code>NEXT_PUBLIC_TARDIS_SAMPLE_PRODUCT</code>
        </li>
      </ul>
    </main>
  );
}
