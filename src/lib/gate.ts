const STORAGE_KEY = 'tardis_gen_count';
const WAITLIST_KEY = 'tardis_waitlisted';
const UTM_KEY = 'tardis_utm';
const FP_KEY = 'tardis_fp';
const FREE_LIMIT = 1;

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ── Browser fingerprint (stable across normal + incognito) ───────────────

/** Simple hash — same algo as Java's String.hashCode. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Vastra fp', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('Vastra fp', 4, 17);
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return `${vendor}~${renderer}`;
  } catch {
    return '';
  }
}

/**
 * Generate a browser fingerprint that is stable across incognito and normal mode.
 * Uses canvas rendering, WebGL GPU info, screen resolution, timezone, and platform.
 * Cached in sessionStorage for the duration of the tab.
 */
export function generateFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr';

  const cached = sessionStorage.getItem(FP_KEY);
  if (cached) return cached;

  const parts = [
    getCanvasFingerprint(),
    getWebGLFingerprint(),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
    navigator.hardwareConcurrency?.toString() || '',
    navigator.language,
  ];

  const raw = parts.join('|||');
  const fp = Math.abs(hashCode(raw)).toString(36);

  sessionStorage.setItem(FP_KEY, fp);
  return fp;
}

// ── Generation counting (client + server) ────────────────────────────────

export function getGenerationCount(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
}

export function isWaitlisted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(WAITLIST_KEY) === '1';
}

export function markWaitlisted(): void {
  localStorage.setItem(WAITLIST_KEY, '1');
  // Also unlock on persistent backend
  const fp = generateFingerprint();
  fetch(`${BACKEND_URL}/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unlock', fingerprint: fp }),
  }).catch(() => {});
}

/** Quick client-side check (used for instant UI gating). */
export function canGenerate(): boolean {
  return getGenerationCount() < FREE_LIMIT || isWaitlisted();
}

/**
 * Increment the generation counter on both client and persistent backend.
 * Call this when a generation completes successfully.
 */
export async function incrementGenerationCount(): Promise<{ allowed: boolean }> {
  // Client side
  const count = getGenerationCount() + 1;
  localStorage.setItem(STORAGE_KEY, String(count));

  // Persistent backend — if server says no, trust the server
  try {
    const fp = generateFingerprint();
    const res = await fetch(`${BACKEND_URL}/gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'increment', fingerprint: fp }),
    });
    if (res.ok) {
      const data = await res.json();
      return { allowed: data.allowed };
    }
  } catch { /* server unreachable — fall back to client */ }

  return { allowed: canGenerate() };
}

/**
 * Server-side check — call before allowing a generation.
 * Hits the persistent Render backend (not Vercel serverless).
 * Falls back to client-side if the server is unreachable.
 */
export async function canGenerateServer(): Promise<boolean> {
  // Fast client check first
  if (isWaitlisted()) return true;

  try {
    const fp = generateFingerprint();
    const res = await fetch(`${BACKEND_URL}/gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', fingerprint: fp }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.allowed;
    }
  } catch { /* server unreachable */ }

  return canGenerate();
}

// ── UTM param capture ────────────────────────────────────────────────────

export interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  referrer: string;
}

/** Call once on page load to capture UTM params from the URL. */
export function captureUtmParams(): void {
  if (typeof window === 'undefined') return;
  // Don't overwrite if already captured this session
  if (sessionStorage.getItem(UTM_KEY)) return;

  const p = new URLSearchParams(window.location.search);
  const utm: UtmParams = {
    utm_source: p.get('utm_source') ?? '',
    utm_medium: p.get('utm_medium') ?? '',
    utm_campaign: p.get('utm_campaign') ?? '',
    utm_term: p.get('utm_term') ?? '',
    utm_content: p.get('utm_content') ?? '',
    referrer: document.referrer ?? '',
  };

  // Infer source from referrer if no UTM params
  if (!utm.utm_source && utm.referrer) {
    try {
      const host = new URL(utm.referrer).hostname.replace('www.', '');
      if (/google\./.test(host)) { utm.utm_source = 'google'; utm.utm_medium = 'organic'; }
      else if (/bing\./.test(host)) { utm.utm_source = 'bing'; utm.utm_medium = 'organic'; }
      else if (/t\.co|twitter\./.test(host)) { utm.utm_source = 'twitter'; utm.utm_medium = 'social'; }
      else if (/instagram\./.test(host)) { utm.utm_source = 'instagram'; utm.utm_medium = 'social'; }
      else if (/linkedin\./.test(host)) { utm.utm_source = 'linkedin'; utm.utm_medium = 'social'; }
      else if (/facebook\./.test(host)) { utm.utm_source = 'facebook'; utm.utm_medium = 'social'; }
      else if (/tardis/.test(host)) { utm.utm_source = 'landing'; utm.utm_medium = 'internal'; }
    } catch { /* invalid URL */ }
  }

  if (!utm.utm_source) {
    utm.utm_source = 'direct';
    utm.utm_medium = 'none';
  }

  sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
}

export function getUtmParams(): UtmParams {
  if (typeof window === 'undefined') {
    return { utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '', referrer: '' };
  }
  try {
    return JSON.parse(sessionStorage.getItem(UTM_KEY) || '{}');
  } catch {
    return { utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '', referrer: '' };
  }
}
