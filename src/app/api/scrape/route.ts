import { NextRequest, NextResponse } from 'next/server';
import { safeFetch, normalizeUrl, SsrfError } from '@/lib/ssrf';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

export interface ScrapeResult {
  title: string | null;
  imageUrls: string[];
  price: string | null;
  category: string | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  description: string | null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing "url" field' }, { status: 400 });
    }

    // Validate scheme/credentials/host up front; reject non-http(s) URLs.
    const resolved = normalizeUrl(url).href;

    // Check if direct image URL
    if (isDirectImageUrl(resolved)) {
      const name = new URL(resolved).pathname
        .split('/').pop()?.replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ') || null;
      return NextResponse.json({
        title: name,
        imageUrls: [resolved],
        price: null,
        category: null,
        widthCm: null,
        heightCm: null,
        depthCm: null,
        description: null,
      } satisfies ScrapeResult);
    }

    // Fetch the page
    const html = await fetchPage(resolved);
    const baseUrl = resolved;

    // Extract data from HTML (meta tags, JSON-LD, img tags)
    const title = extractTitle(html);
    const imageUrls = extractProductImageUrls(html, baseUrl, 10);
    const price = extractPrice(html);
    const category = detectCategory(html);
    const dimensions = extractDimensions(html);

    // Call Gemini for structured extraction (better title, description, refined dimensions)
    let geminiData: GeminiExtracted | null = null;
    if (GEMINI_API_KEY) {
      try {
        geminiData = await extractWithGemini(html);
      } catch (err) {
        console.warn('[Gemini] Extraction failed:', err);
      }
    }

    const result: ScrapeResult = {
      title: geminiData?.title || title,
      imageUrls,
      price: geminiData?.price || price,
      category: geminiData?.category || category,
      widthCm: geminiData?.widthCm ?? dimensions.widthCm,
      heightCm: geminiData?.heightCm ?? dimensions.heightCm,
      depthCm: geminiData?.depthCm ?? dimensions.depthCm,
      description: geminiData?.description ?? null,
    };

    return NextResponse.json(result);
  } catch (err) {
    // SsrfError carries a user-safe message and means the URL was disallowed.
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Anything else may contain internal detail — log it, return a generic error.
    console.error('[Scrape] Error:', err);
    return NextResponse.json(
      { error: 'We could not read that product page. Please check the URL and try again.' },
      { status: 502 },
    );
  }
}

// ── Fetch page ───────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const res = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    allowedContentTypes: ['text/html', 'application/xhtml+xml', 'application/xml', 'text/plain'],
    perHopTimeoutMs: 15_000,
    totalTimeoutMs: 20_000,
    maxBytes: 8 * 1024 * 1024,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Failed to fetch page: HTTP ${res.status}`);
  }

  return res.body.toString('utf-8');
}

// ── Direct image check ───────────────────────────────────────────────────────

function isDirectImageUrl(url: string): boolean {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext);
}

// ── Title extraction ─────────────────────────────────────────────────────────

function extractTitle(html: string): string | null {
  let raw: string | null = null;

  // og:title
  const og = extractMetaContent(html, 'property', 'og:title');
  if (og) raw = og;

  // <title> fallback
  if (!raw) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)/i);
    if (titleMatch) raw = titleMatch[1].trim();
  }

  if (!raw) return null;

  // Strip store suffixes like "Product | StoreName", "Product - IKEA", "Product — Store"
  return raw.split(/\s*[|–—]\s*/)[0]
    .replace(/\s+-\s+\w+.*$/, '')  // " - IKEA", " - Amazon", etc.
    .replace(/\s*\(\d+\)$/, '')     // trailing "(123)"
    .trim() || null;
}

// ── Price extraction ─────────────────────────────────────────────────────────

function extractPrice(html: string): string | null {
  // Meta tags
  const metaPatterns = [
    { attr: 'property', val: 'product:price:amount' },
    { attr: 'property', val: 'og:price:amount' },
    { attr: 'itemprop', val: 'price' },
    { attr: 'name', val: 'twitter:data1' },
  ];

  for (const { attr, val } of metaPatterns) {
    const content = extractMetaContent(html, attr, val);
    if (content) return normalizePrice(content);
  }

  // JSON-LD price
  const jsonLdPrice = html.match(/"price"\s*:\s*"?(\d[\d.,]*)"?/);
  if (jsonLdPrice) {
    const currency = html.match(/"priceCurrency"\s*:\s*"([^"]+)"/);
    const symbol = currency ? currencySymbol(currency[1]) : '$';
    return `${symbol}${jsonLdPrice[1]}`;
  }

  // Fallback: first currency-looking token in stripped text
  const text = html.replace(/<[^>]+>/g, ' ');
  const currencyMatch = text.match(/[$€£¥]\s?\d[\d.,]*(?:\s?[-–]\s?[$€£¥]?\s?\d[\d.,]*)?/i);
  if (currencyMatch) return normalizePrice(currencyMatch[0]);

  return null;
}

function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$', PLN: 'zł', SEK: 'kr',
  };
  return map[code.toUpperCase()] || code + ' ';
}

function normalizePrice(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[,;.\s]+$/, '')  // strip trailing commas, semicolons, dots, spaces
    .trim();
}

// ── Image extraction ─────────────────────────────────────────────────────────

function extractProductImageUrls(html: string, baseUrl: string, limit: number): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  function add(raw: string) {
    if (results.length >= limit) return;
    const resolved = resolveUrl(raw, baseUrl);
    if (!isLikelyProductImage(resolved)) return;
    const base = resolved.split('?')[0];
    if (seen.has(base)) return;
    seen.add(base);
    results.push(resolved);
  }

  // 1. og:image / Twitter card
  for (const prop of ['og:image', 'og:image:secure_url']) {
    const v = extractMetaContent(html, 'property', prop);
    if (v) add(v);
  }
  for (const name of ['twitter:image', 'twitter:image:src']) {
    const v = extractMetaContent(html, 'name', name);
    if (v) add(v);
  }

  // 2. JSON-LD image fields
  const jsonLdImages = html.matchAll(/"image"\s*:\s*\[?"(https?:\/\/[^"]+)"/gi);
  for (const m of jsonLdImages) add(m[1]);

  // 3. srcset first URLs
  const srcsets = html.matchAll(/srcset\s*=\s*["']\s*(https?:\/\/[^"',\s]+\.(?:jpg|jpeg|png|webp)[^"',\s]*)/gi);
  for (const m of srcsets) add(m[1]);

  // 4. <img src> with image extensions
  const imgs = html.matchAll(/<img[^>]+src\s*=\s*["'](https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)[^"'\s]*)["']/gi);
  for (const m of imgs) add(m[1]);

  // 5. Product/hero class images
  const classImgs = html.matchAll(/<img[^>]+class\s*=\s*["'][^"']*(?:product|hero|main|primary|gallery|pip-image)[^"']*["'][^>]+src\s*=\s*["']([^"']+)["']/gi);
  for (const m of classImgs) add(m[1]);

  // 6. Fallback: any large image
  if (results.length === 0) {
    const anyImg = html.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi);
    for (const m of anyImg) {
      if (isLikelyProductImage(m[1])) {
        add(m[1]);
        if (results.length >= 3) break;
      }
    }
  }

  return results;
}

function isLikelyProductImage(url: string): boolean {
  const lower = url.toLowerCase();
  const blocklist = ['logo', 'icon', 'favicon', 'pixel', 'tracker', 'badge', 'sprite', '1x1', 'spacer', 'blank'];
  return !blocklist.some(b => lower.includes(b));
}

// ── Category detection ───────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  table: ['table', 'dining table', 'coffee table', 'side table', 'console', 'stolik', 'stół'],
  chair: ['chair', 'stool', 'bar stool', 'armchair', 'krzesło', 'fotel'],
  sofa: ['sofa', 'couch', 'loveseat', 'sectional', 'settee', 'kanapa'],
  bed: ['bed', 'mattress', 'headboard', 'łóżko'],
  shelf: ['shelf', 'bookshelf', 'bookcase', 'shelving', 'regał', 'półka'],
  lamp: ['lamp', 'light', 'chandelier', 'sconce', 'pendant', 'lampa'],
  desk: ['desk', 'writing desk', 'office desk', 'biurko'],
  cabinet: ['cabinet', 'dresser', 'wardrobe', 'sideboard', 'szafka', 'komoda'],
  rug: ['rug', 'carpet', 'mat', 'dywan'],
  storage: ['storage', 'organizer', 'bin', 'basket'],
};

function detectCategory(html: string): string | null {
  const text = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  let best: string | null = null;
  let bestLen = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw) && kw.length > bestLen) {
        bestLen = kw.length;
        best = cat;
      }
    }
  }

  return best;
}

// ── Dimension extraction from HTML ──────────────────────────────────────────

interface Dimensions {
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
}

function extractDimensions(html: string): Dimensions {
  const dims: Dimensions = { widthCm: null, heightCm: null, depthCm: null };

  // 1. JSON-LD Product schema — look for width/height/depth in structured data
  const jsonLdBlocks = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Product' || item?.mainEntity?.['@type'] === 'Product') {
          const product = item['@type'] === 'Product' ? item : item.mainEntity;
          // Check additionalProperty for dimensions
          if (Array.isArray(product.additionalProperty)) {
            for (const prop of product.additionalProperty) {
              const name = (prop.name || '').toLowerCase();
              const val = parseFloat(prop.value);
              if (isNaN(val)) continue;
              const unit = (prop.unitCode || prop.unitText || 'cm').toLowerCase();
              const cm = toCm(val, unit);
              if (name.includes('width') || name.includes('szerokość') || name.includes('bredd')) dims.widthCm = cm;
              else if (name.includes('height') || name.includes('wysokość') || name.includes('höjd')) dims.heightCm = cm;
              else if (name.includes('depth') || name.includes('głębokość') || name.includes('length') || name.includes('djup')) dims.depthCm = cm;
            }
          }
          // Check direct dimension fields
          if (product.width?.value) dims.widthCm = toCm(parseFloat(product.width.value), product.width.unitCode || 'cm');
          if (product.height?.value) dims.heightCm = toCm(parseFloat(product.height.value), product.height.unitCode || 'cm');
          if (product.depth?.value) dims.depthCm = toCm(parseFloat(product.depth.value), product.depth.unitCode || 'cm');
        }
      }
    } catch { /* ignore parse errors */ }
  }

  if (dims.widthCm && dims.heightCm) return dims;

  // 2. Text patterns: look for labeled dimensions in page text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  // Pattern: "Width: 22 cm" / "Szerokość: 22 cm" / "Height 33cm"
  const dimPatterns: { keys: string[]; field: keyof Dimensions }[] = [
    { keys: ['width', 'szerokość', 'bredd', 'largeur', 'breite', 'ancho'], field: 'widthCm' },
    { keys: ['height', 'wysokość', 'höjd', 'hauteur', 'höhe', 'alto', 'tall'], field: 'heightCm' },
    { keys: ['depth', 'głębokość', 'djup', 'profondeur', 'tiefe', 'length', 'długość'], field: 'depthCm' },
  ];

  for (const { keys, field } of dimPatterns) {
    if (dims[field]) continue;
    for (const key of keys) {
      const re = new RegExp(`${key}[:\\s]*([\\d.,]+)\\s*(cm|mm|m|in|inch|inches|"|″|ft|feet)?`, 'i');
      const m = text.match(re);
      if (m) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(val) && val > 0 && val < 1000) {
          dims[field] = toCm(val, m[2] || 'cm');
          break;
        }
      }
    }
  }

  if (dims.widthCm && dims.heightCm) return dims;

  // 3. Compact pattern: "22 x 33 x 44 cm" or "22×33×44 cm"
  const compactRe = /(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|inch|inches|"|″)?/;
  const compactMatch = text.match(compactRe);
  if (compactMatch) {
    const unit = compactMatch[4] || 'cm';
    const a = toCm(parseFloat(compactMatch[1].replace(',', '.')), unit);
    const b = toCm(parseFloat(compactMatch[2].replace(',', '.')), unit);
    const c = toCm(parseFloat(compactMatch[3].replace(',', '.')), unit);
    // Assign: widest = width, tallest = height, smallest = depth
    const sorted = [a, b, c].sort((x, y) => y - x);
    if (!dims.widthCm) dims.widthCm = Math.round(sorted[0]);
    if (!dims.heightCm) dims.heightCm = Math.round(sorted[1]);
    if (!dims.depthCm) dims.depthCm = Math.round(sorted[2]);
    return dims;
  }

  // 4. Two-value pattern: "22 x 33 cm"
  const twoValRe = /(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|inch|inches|"|″)?/;
  const twoMatch = text.match(twoValRe);
  if (twoMatch) {
    const unit = twoMatch[3] || 'cm';
    const a = toCm(parseFloat(twoMatch[1].replace(',', '.')), unit);
    const b = toCm(parseFloat(twoMatch[2].replace(',', '.')), unit);
    if (!dims.widthCm) dims.widthCm = Math.round(Math.max(a, b));
    if (!dims.heightCm) dims.heightCm = Math.round(Math.min(a, b));
  }

  return dims;
}

function toCm(value: number, unit: string): number {
  const u = (unit || 'cm').toLowerCase().replace(/\s/g, '');
  if (u === 'mm') return Math.round(value / 10);
  if (u === 'm') return Math.round(value * 100);
  if (u === 'in' || u === 'inch' || u === 'inches' || u === '"' || u === '″') return Math.round(value * 2.54);
  if (u === 'ft' || u === 'feet') return Math.round(value * 30.48);
  return Math.round(value); // assume cm
}

// ── Gemini structured extraction ─────────────────────────────────────────────

interface GeminiExtracted {
  title: string | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  category: string | null;
  description: string | null;
  price: string | null;
}

async function extractWithGemini(html: string): Promise<GeminiExtracted> {
  // Strip to text, truncate
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.slice(0, 15000);

  const prompt = `You are a furniture product data extractor. Analyze the following product page text and extract:
1. Product name/title (clean, without store name or marketing text)
2. Physical dimensions in centimeters: width, height, depth
3. Product category
4. A concise product description (2-3 sentences) covering materials, finish, style, and key features
5. Product price (single value or range with currency symbol/code)

Rules:
- Convert any non-cm units (inches, mm, m, feet) to centimeters.
- Use PRODUCT dimensions, NOT packaging/shipping dimensions.
- If a dimension is not listed, estimate it based on the product type and other known dimensions.
- Category must be exactly one of: table, chair, sofa, bed, television, shelf, lamp, desk, refrigerator, storage, other
- The page can be in any language. Extract the info regardless of language.
- Keep the description factual and concise.
- Price should include a currency symbol or code when possible.

Product page text:
${text}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title:       { type: 'STRING' },
          widthCm:     { type: 'NUMBER' },
          heightCm:    { type: 'NUMBER' },
          depthCm:     { type: 'NUMBER' },
          description: { type: 'STRING' },
          price:       { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: ['table', 'chair', 'sofa', 'bed', 'television', 'shelf', 'lamp', 'desk', 'refrigerator', 'storage', 'other'],
          },
        },
        required: ['title', 'widthCm', 'heightCm', 'depthCm', 'category', 'description', 'price'],
      },
    },
  };

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) throw new Error('No text in Gemini response');

  return JSON.parse(textPart);
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function extractMetaContent(html: string, attrName: string, attrValue: string): string | null {
  // property="og:title" content="..." or content="..." property="og:title"
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+${attrName}\\s*=\\s*["']${escaped}["'][^>]+content\\s*=\\s*["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+${attrName}\\s*=\\s*["']${escaped}["']`, 'i'),
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function resolveUrl(raw: string, base: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  try {
    return new URL(raw, base).href;
  } catch {
    return raw;
  }
}
