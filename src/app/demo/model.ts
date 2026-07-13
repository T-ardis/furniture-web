import type { AppConfig } from '@/lib/config';

/** Fully-resolved, non-null embed values ready to install the real loader. */
export interface ResolvedEmbed {
  widgetUrl: string;
  edgeUrl: string;
  collectorUrl: string;
  key: string;
  sampleProduct: string;
}

export type DemoModel =
  | { available: false }
  | { available: true; embed: ResolvedEmbed };

/**
 * Decide whether the B2B demo can install the real tardis-embed widget.
 * Requires every embed value to be present — otherwise the page must show an
 * honest demo-unavailable state and never fabricate a product or emit a null
 * into the embed snippet.
 */
export function buildDemoModel(config: AppConfig): DemoModel {
  const { widgetUrl, edgeUrl, collectorUrl, key, sampleProduct } = config.embed;
  if (!config.isDemoConfigured || !widgetUrl || !edgeUrl || !collectorUrl || !key || !sampleProduct) {
    return { available: false };
  }
  return { available: true, embed: { widgetUrl, edgeUrl, collectorUrl, key, sampleProduct } };
}
