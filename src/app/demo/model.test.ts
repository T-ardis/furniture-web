import { describe, it, expect } from 'vitest';
import { buildDemoModel } from './model';
import type { AppConfig } from '@/lib/config';

function cfg(overrides: Partial<AppConfig['embed']>, isDemoConfigured: boolean): AppConfig {
  return {
    apiUrl: null,
    apiKey: '',
    landingUrl: 'https://www.tardis-ai.com',
    embed: {
      widgetUrl: null,
      edgeUrl: null,
      collectorUrl: null,
      key: null,
      sampleProduct: null,
      ...overrides,
    },
    isBackendConfigured: false,
    isDemoConfigured,
  };
}

describe('buildDemoModel', () => {
  it('reports unavailable when the demo is not configured', () => {
    const model = buildDemoModel(cfg({}, false));
    expect(model.available).toBe(false);
    expect('embed' in model).toBe(false);
  });

  it('reports unavailable even if isDemoConfigured is true but a value is somehow missing', () => {
    // defensive: a null value must never be emitted into the embed snippet
    const model = buildDemoModel(cfg({ widgetUrl: 'https://cdn/embed.js' }, true));
    expect(model.available).toBe(false);
  });

  it('exposes the canonical embed values when fully configured', () => {
    const model = buildDemoModel(
      cfg(
        {
          widgetUrl: 'https://cdn.example.com/v1/embed.js',
          edgeUrl: 'https://edge.example.com',
          collectorUrl: 'https://collector.example.com',
          key: 'pk_live_abc',
          sampleProduct: 'SKU-123',
        },
        true,
      ),
    );
    expect(model.available).toBe(true);
    if (model.available) {
      expect(model.embed).toEqual({
        widgetUrl: 'https://cdn.example.com/v1/embed.js',
        edgeUrl: 'https://edge.example.com',
        collectorUrl: 'https://collector.example.com',
        key: 'pk_live_abc',
        sampleProduct: 'SKU-123',
      });
    }
  });
});
