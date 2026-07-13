import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConfig } from './config';

const EMBED_VARS = [
  'NEXT_PUBLIC_TARDIS_WIDGET_URL',
  'NEXT_PUBLIC_TARDIS_EDGE_URL',
  'NEXT_PUBLIC_TARDIS_COLLECTOR_URL',
  'NEXT_PUBLIC_TARDIS_KEY',
  'NEXT_PUBLIC_TARDIS_SAMPLE_PRODUCT',
];

function clearAll() {
  vi.stubEnv('NEXT_PUBLIC_API_URL', '');
  vi.stubEnv('NEXT_PUBLIC_API_KEY', '');
  for (const v of EMBED_VARS) vi.stubEnv(v, '');
}

afterEach(() => vi.unstubAllEnvs());

describe('getConfig — backend API', () => {
  it('falls back to localhost outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    clearAll();
    const c = getConfig();
    expect(c.apiUrl).toBe('http://localhost:8080');
    expect(c.isBackendConfigured).toBe(true);
  });

  it('never falls back to localhost in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    clearAll();
    const c = getConfig();
    expect(c.apiUrl).toBeNull();
    expect(c.isBackendConfigured).toBe(false);
  });

  it('uses an explicit API URL in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    clearAll();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.tardis-ai.com');
    const c = getConfig();
    expect(c.apiUrl).toBe('https://api.tardis-ai.com');
    expect(c.isBackendConfigured).toBe(true);
  });
});

describe('getConfig — B2B embed demo', () => {
  it('is not configured when embed vars are missing (no localhost fabrication)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    clearAll();
    const c = getConfig();
    expect(c.isDemoConfigured).toBe(false);
    expect(c.embed.widgetUrl).toBeNull();
    expect(c.embed.key).toBeNull();
    expect(c.embed.sampleProduct).toBeNull();
  });

  it('is configured only when all five embed values are present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    clearAll();
    vi.stubEnv('NEXT_PUBLIC_TARDIS_WIDGET_URL', 'https://cdn.example.com/v1/embed.js');
    vi.stubEnv('NEXT_PUBLIC_TARDIS_EDGE_URL', 'https://edge.example.com');
    vi.stubEnv('NEXT_PUBLIC_TARDIS_COLLECTOR_URL', 'https://collector.example.com');
    vi.stubEnv('NEXT_PUBLIC_TARDIS_KEY', 'pk_live_abc');
    // still missing sample product
    expect(getConfig().isDemoConfigured).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_TARDIS_SAMPLE_PRODUCT', 'SKU-123');
    const c = getConfig();
    expect(c.isDemoConfigured).toBe(true);
    expect(c.embed).toEqual({
      widgetUrl: 'https://cdn.example.com/v1/embed.js',
      edgeUrl: 'https://edge.example.com',
      collectorUrl: 'https://collector.example.com',
      key: 'pk_live_abc',
      sampleProduct: 'SKU-123',
    });
  });

  it('trims surrounding whitespace and treats blank as unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    clearAll();
    vi.stubEnv('NEXT_PUBLIC_TARDIS_KEY', '   ');
    expect(getConfig().embed.key).toBeNull();
  });
});
