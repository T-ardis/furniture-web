import { getConfig } from './config';

const EMAIL_KEY = 'tardis_email';
const UTM_KEY = 'tardis_utm';

const BACKEND_URL = getConfig().apiUrl;

// ── Email session ────────────────────────────────────────────────────────

export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(EMAIL_KEY);
}

export function storeEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email.toLowerCase().trim());
}

export function clearEmail(): void {
  localStorage.removeItem(EMAIL_KEY);
}

/**
 * Check if email exists in the Notion waitlist DB.
 * Calls the Next.js API route (server-side Notion query).
 */
export async function checkEmailInWaitlist(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.found;
    }
  } catch { /* server unreachable */ }
  return false;
}

// ── Generation counting (on persistent Render backend) ───────────────────

/**
 * Check if this email can still generate (has remaining generations).
 */
export async function canGenerate(email: string): Promise<boolean> {
  if (!BACKEND_URL) return false; // backend unconfigured — fail closed
  try {
    const res = await fetch(`${BACKEND_URL}/gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', email }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.allowed;
    }
  } catch { /* server unreachable */ }
  return false;
}

/**
 * Increment generation count for this email.
 * Call when a generation completes successfully.
 */
export async function incrementGenerationCount(email: string): Promise<{ allowed: boolean }> {
  if (!BACKEND_URL) return { allowed: false }; // backend unconfigured — fail closed
  try {
    const res = await fetch(`${BACKEND_URL}/gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'increment', email }),
    });
    if (res.ok) {
      const data = await res.json();
      return { allowed: data.allowed };
    }
  } catch { /* server unreachable */ }
  return { allowed: false };
}

// ── Auto-signup (demo gate flow) ─────────────────────────────────────────

/**
 * Auto-add email to Notion waitlist via /api/waitlist.
 * Used when a new user enters their email through the demo gate.
 */
export async function autoSignupEmail(email: string): Promise<boolean> {
  try {
    const utm = getUtmParams();
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        utm_source: utm.utm_source || 'furniture-web',
        utm_medium: 'demo-gate',
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
        referrer: utm.referrer,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
