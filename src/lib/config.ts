/**
 * Typed environment reader for furniture-web.
 *
 * Rules (design §7):
 *   - localhost defaults are convenient in dev/test only — never in production;
 *   - a production build with missing service config reports "unconfigured"
 *     rather than silently pointing at localhost;
 *   - the B2B demo is only "configured" when every embed value is present, so
 *     the demo page can honestly refuse to fabricate a product.
 *
 * NEXT_PUBLIC_* vars must be referenced literally so Next inlines them into the
 * browser bundle. Values are read per-call so server and client stay in sync.
 */

export interface TardisEmbedConfig {
  widgetUrl: string | null;
  edgeUrl: string | null;
  collectorUrl: string | null;
  key: string | null;
  sampleProduct: string | null;
}

export interface AppConfig {
  /** tardis backend base URL for the consumer demo. */
  apiUrl: string | null;
  /** X-API-Key for the consumer backend (intentionally public). */
  apiKey: string;
  /** Marketing/landing site URL. */
  landingUrl: string;
  /** Canonical tardis-embed loader config for the B2B demo. */
  embed: TardisEmbedConfig;
  /** True when the consumer backend URL is known. */
  isBackendConfigured: boolean;
  /** True only when every embed value needed to install the real widget is set. */
  isDemoConfigured: boolean;
}

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Read a value, falling back to a localhost default only outside production. */
function withDevDefault(value: string | undefined, devFallback: string): string | null {
  return clean(value) ?? (isProduction() ? null : devFallback);
}

export function getConfig(): AppConfig {
  const apiUrl = withDevDefault(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:8080');
  const apiKey = clean(process.env.NEXT_PUBLIC_API_KEY) ?? '';
  const landingUrl = clean(process.env.NEXT_PUBLIC_LANDING_URL) ?? 'https://www.tardis-ai.com';

  const embed: TardisEmbedConfig = {
    widgetUrl: clean(process.env.NEXT_PUBLIC_TARDIS_WIDGET_URL),
    edgeUrl: clean(process.env.NEXT_PUBLIC_TARDIS_EDGE_URL),
    collectorUrl: clean(process.env.NEXT_PUBLIC_TARDIS_COLLECTOR_URL),
    key: clean(process.env.NEXT_PUBLIC_TARDIS_KEY),
    sampleProduct: clean(process.env.NEXT_PUBLIC_TARDIS_SAMPLE_PRODUCT),
  };

  const isDemoConfigured =
    embed.widgetUrl !== null &&
    embed.edgeUrl !== null &&
    embed.collectorUrl !== null &&
    embed.key !== null &&
    embed.sampleProduct !== null;

  return {
    apiUrl,
    apiKey,
    landingUrl,
    embed,
    isBackendConfigured: apiUrl !== null,
    isDemoConfigured,
  };
}
