import type { Metadata } from 'next';
import Script from 'next/script';
import { getConfig } from '@/lib/config';
import { buildDemoModel, type ResolvedEmbed } from './model';
import { QtyStepper } from './qty-stepper';
import styles from './demo.module.css';

export const metadata: Metadata = {
  title: 'Retailer demo — TARDIS embed',
  description:
    'A demonstration retailer product page running the real, installed TARDIS embed. One script tag adds “View in your room” AR and live wall preview to any storefront.',
  robots: { index: false, follow: false },
};

const WALLPAPER = '/demo/patterns/wallpaper-trellis.png';
const TILE = '/demo/patterns/tile-zellige.png';

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
          <span>Wallcoverings</span>
          <span>Lighting</span>
        </nav>
      </header>

      <p className={styles.banner}>
        This is a mock retailer product page. Both the{' '}
        <strong>View in your room</strong> button (3D&nbsp;+&nbsp;native AR) and the{' '}
        <strong>See it on your wall</strong> button (live in-browser camera) below are
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
        {/* ── Product 1 — Halden sofa (object mode: 3D + AR) ─────────── */}
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

        {/* ── Product 2 — Arlo wallcovering (surface mode: live camera) ─── */}
        <section className={`${styles.product} ${styles.dept}`} id="wallcoverings" aria-label="Arlo Wallcovering">
          <div className={styles.deptHead}>
            <p className={styles.eyebrow}>New this season</p>
            <h2 className={styles.deptTitle}>Wallcoverings</h2>
          </div>

          <div className={styles.pdp}>
            <div className={styles.gallery}>
              <div
                className={styles.wallPanel}
                role="img"
                aria-label="Arlo wallcovering, repeated swatch shown at roll scale"
              >
                <span className={styles.stageHint}>◱ Preview it live on your wall</span>
              </div>
            </div>

            <section className={styles.details}>
              <nav className={styles.breadcrumb}>Walls / Wallcoverings / Arlo</nav>
              <p className={styles.eyebrow}>The Arlo Collection</p>
              <h2 className={styles.title}>Arlo Wallcovering — Sage Trellis</h2>

              <div className={styles.rating}>
                <span className={styles.stars} aria-hidden="true">
                  ★★★★★
                </span>
                <span className={styles.ratingText}>4.7 · 86 reviews</span>
              </div>

              <div className={styles.price}>
                <span className={styles.priceNow}>$96</span>
                <span className={styles.priceUnit}>per 10&nbsp;m roll</span>
              </div>

              <p className={styles.copy}>
                A hand-drawn trellis on matte non-woven paper — paste-the-wall,
                dry-strippable, made to order in Ghent. The motif is also available as
                a glazed zellige tile and a colour-matched limewash paint.
              </p>

              <div className={styles.opt}>
                <div className={styles.optHead}>
                  <span className={styles.optKey}>Finish</span>
                  <span className={`${styles.optVal} ${styles.finishName}`}>
                    <span className="fn-wallpaper">Sage Trellis wallpaper</span>
                    <span className="fn-tile">Marin Zellige tile</span>
                    <span className="fn-paint">Clay Limewash paint</span>
                  </span>
                </div>
                <div className={styles.swatches}>
                  <input
                    className={styles.vhInput}
                    type="radio"
                    name="finish"
                    id="finish-wallpaper"
                    defaultChecked
                  />
                  <label
                    className={styles.finishChip}
                    htmlFor="finish-wallpaper"
                    style={{ backgroundImage: `url(${WALLPAPER})` }}
                    aria-label="Sage Trellis wallpaper"
                  />
                  <input className={styles.vhInput} type="radio" name="finish" id="finish-tile" />
                  <label
                    className={styles.finishChip}
                    htmlFor="finish-tile"
                    style={{ backgroundImage: `url(${TILE})` }}
                    aria-label="Marin Zellige tile"
                  />
                  <input className={styles.vhInput} type="radio" name="finish" id="finish-paint" />
                  <label
                    className={styles.finishChip}
                    htmlFor="finish-paint"
                    style={{ background: '#c9b8a3' }}
                    aria-label="Clay Limewash paint"
                  />
                </div>
              </div>

              <div className={styles.buyRow}>
                <QtyStepper label="Quantity (rolls)" />
                <button className={styles.addToCart} type="button">
                  Add to cart
                </button>
              </div>

              {/* Canonical TARDIS embed trigger — surface mode (design §4). */}
              <button data-tardis data-product="arlo-wallcovering" data-mode="surface" className={styles.arButton}>
                See it on your wall
              </button>

              <p className={styles.previewNote}>
                Live in-browser camera preview — colour and scale are approximate.
                Works on iPhone and Android, no app needed.
              </p>

              <div className={styles.accordions}>
                <details className={styles.acc} open>
                  <summary className={styles.accSummary}>
                    Details <span className={styles.plus}>+</span>
                  </summary>
                  <div className={styles.accBody}>
                    Arlo is drawn by hand and printed with water-based inks on
                    FSC-certified non-woven paper. The diagonal trellis carries a
                    straight match, so lengths line up without pattern waste.
                  </div>
                </details>
                <details className={styles.acc}>
                  <summary className={styles.accSummary}>
                    Specifications <span className={styles.plus}>+</span>
                  </summary>
                  <div className={styles.accBody}>
                    <dl className={styles.specs}>
                      <div className={styles.spec}>
                        <dt>Roll width</dt>
                        <dd>52 cm / 20.5″</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Roll length</dt>
                        <dd>10 m / 32.8 ft</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Pattern match</dt>
                        <dd>Straight match</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Application</dt>
                        <dd>Paste the wall</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Removal</dt>
                        <dd>Dry-strippable</dd>
                      </div>
                      <div className={styles.spec}>
                        <dt>Coverage</dt>
                        <dd>≈ 5.2 m² per roll</dd>
                      </div>
                    </dl>
                  </div>
                </details>
                <details className={styles.acc}>
                  <summary className={styles.accSummary}>
                    Application &amp; care <span className={styles.plus}>+</span>
                  </summary>
                  <div className={styles.accBody}>
                    Hang on a clean, primed wall with a standard non-woven adhesive.
                    Wipeable with a damp cloth; avoid abrasive cleaners.
                  </div>
                </details>
              </div>

              <p className={styles.sku}>Product: arlo-wallcovering</p>
            </section>
          </div>
        </section>

        {/* ── Completes the room ────────────────────────────────────── */}
        <section className={styles.related} aria-label="Completes the room">
          <h2 className={styles.relatedTitle}>Completes the room</h2>
          <div className={styles.relatedGrid}>
            <article className={styles.card}>
              <span className={styles.cardMedia}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/demo/sofa.webp"
                  alt=""
                  className={styles.cardImg}
                  style={{ transform: 'scale(1.6)', objectPosition: '20% 50%' }}
                />
              </span>
              <h3 className={styles.cardTitle}>Halden Armchair</h3>
              <p className={styles.cardPrice}>$749</p>
            </article>
            <article className={styles.card}>
              <span className={styles.cardMedia}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/demo/sofa.webp"
                  alt=""
                  className={styles.cardImg}
                  style={{ transform: 'scale(2.1)', objectPosition: '70% 60%' }}
                />
              </span>
              <h3 className={styles.cardTitle}>Halden Ottoman</h3>
              <p className={styles.cardPrice}>$399</p>
            </article>
            <article className={styles.card}>
              <span
                className={styles.cardMedia}
                style={{
                  backgroundImage: `url(${WALLPAPER})`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '64px 64px',
                }}
              />
              <h3 className={styles.cardTitle}>Arlo Sample Set</h3>
              <p className={styles.cardPrice}>$8</p>
            </article>
            <article className={styles.card}>
              <span
                className={styles.cardMedia}
                style={{
                  backgroundImage: `url(${TILE})`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '72px 72px',
                }}
              />
              <h3 className={styles.cardTitle}>Marin Zellige — box of 44</h3>
              <p className={styles.cardPrice}>$118</p>
            </article>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footBrand}>
          <span className={styles.storeName}>NORTHWIND HOME</span>
          <p className={styles.footNote}>
            Considered furniture and wallcoverings for real rooms. This is a
            demonstration storefront — every product here installs the real TARDIS
            embed.
          </p>
        </div>
        <div className={styles.footCols}>
          <div className={styles.footCol}>
            <h4>Shop</h4>
            <span>Sofas</span>
            <span>Wallcoverings</span>
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
        auto-scans BOTH triggers above (object + surface).
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
