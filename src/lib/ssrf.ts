import { lookup as nodeLookup } from 'node:dns/promises';
import { Agent } from 'undici';

/**
 * Reusable SSRF / URL-safety policy for server-side fetches.
 *
 * Semantics mirror design §5.2 (and tardis-admin's ingestion policy):
 *   - only HTTP(S) is allowed;
 *   - DNS is re-resolved for every redirect hop and any resolved loopback,
 *     link-local, private, multicast, reserved, or cloud-metadata address is
 *     rejected;
 *   - fetches have bounded redirect count, body size, content-type, and time.
 *
 * All failures surface as SsrfError with generic, user-safe messages — callers
 * translate these into honest 4xx/5xx responses without leaking internals.
 */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Normalize a user-supplied URL string:
 *   - a bare or scheme-relative host defaults to https;
 *   - only http(s) is permitted;
 *   - embedded credentials and a missing/global-wildcard host are rejected.
 * Path, query, and fragment are preserved (scraping needs the full URL).
 */
export function normalizeUrl(input: string): URL {
  if (typeof input !== 'string') throw new SsrfError('A URL string is required');
  let raw = input.trim();
  if (!raw) throw new SsrfError('A URL is required');

  if (!SCHEME_RE.test(raw)) {
    raw = raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError('The URL is not valid');
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new SsrfError('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new SsrfError('URLs with embedded credentials are not allowed');
  }
  const host = stripBrackets(url.hostname);
  if (!host || host === '*') {
    throw new SsrfError('The URL host is missing or invalid');
  }
  return url;
}

// ── IP classification ────────────────────────────────────────────────────────

function parseIPv4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidrV4(ip: number, base: string, prefix: number): boolean {
  const baseNum = parseIPv4(base)!;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (baseNum & mask);
}

// Loopback / private / link-local (incl. metadata) / CGNAT / reserved /
// multicast / documentation / benchmarking ranges — none are safe to fetch.
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function isBlockedV4(ip: number): boolean {
  return BLOCKED_V4.some(([base, prefix]) => inCidrV4(ip, base, prefix));
}

function parseIPv6(ip: string): number[] | null {
  let addr = ip;
  const zone = addr.indexOf('%');
  if (zone !== -1) addr = addr.slice(0, zone);
  if (!addr.includes(':')) return null;

  // Split off a trailing embedded IPv4 (e.g. ::ffff:1.2.3.4).
  let embeddedV4: number[] | null = null;
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (v4 === null) return null;
    embeddedV4 = [(v4 >>> 16) & 0xffff, v4 & 0xffff];
    addr = addr.slice(0, lastColon + 1) + '0:0';
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (s: string): number[] | null => {
    if (s === '') return [];
    const groups: number[] = [];
    for (const g of s.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      groups.push(parseInt(g, 16));
    }
    return groups;
  };

  let head: number[] | null;
  let tailGroups: number[] | null;
  if (halves.length === 2) {
    head = parseGroups(halves[0]);
    tailGroups = parseGroups(halves[1]);
    if (head === null || tailGroups === null) return null;
    const missing = 8 - head.length - tailGroups.length;
    if (missing < 0) return null;
    const groups = [...head, ...new Array(missing).fill(0), ...tailGroups];
    return applyEmbedded(groups, embeddedV4);
  }
  head = parseGroups(addr);
  if (head === null || head.length !== 8) return null;
  return applyEmbedded(head, embeddedV4);
}

function applyEmbedded(groups: number[], embeddedV4: number[] | null): number[] | null {
  if (groups.length !== 8) return null;
  if (embeddedV4) {
    groups[6] = embeddedV4[0];
    groups[7] = embeddedV4[1];
  }
  return groups;
}

function isBlockedV6(groups: number[]): boolean {
  const isZero = (n: number) => groups.slice(0, n).every((g) => g === 0);
  // ::  (unspecified) and ::1 (loopback)
  if (isZero(7)) return groups[7] === 0 || groups[7] === 1;
  // fe80::/10 link-local
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  // fc00::/7 unique-local
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  // ff00::/8 multicast
  if ((groups[0] & 0xff00) === 0xff00) return true;
  // 2001:db8::/32 documentation
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
  return false;
}

/** Returns true if an IP literal must not be fetched. Fails closed on non-IPs. */
export function isBlockedAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isBlockedV4(v4);

  const v6 = parseIPv6(ip);
  if (v6 !== null) {
    // IPv4-mapped (::ffff:a.b.c.d) / IPv4-compatible — judge by the v4.
    const firstFive = v6.slice(0, 5).every((g) => g === 0);
    if (firstFive && (v6[5] === 0xffff || v6[5] === 0)) {
      const embedded = ((v6[6] << 16) | v6[7]) >>> 0;
      // Skip pure :: / ::1 which were already handled by isBlockedV6.
      if (!(v6[5] === 0 && embedded <= 1)) return isBlockedV4(embedded);
    }
    return isBlockedV6(v6);
  }
  // Not a parseable IP — never fetch it.
  return true;
}

// ── Guarded fetch ──────────────────────────────────────────────────────────

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type DnsLookup = (hostname: string) => Promise<ResolvedAddress[]>;

/**
 * A node/undici-style connect lookup: `lookup(hostname, options, callback)`,
 * where `callback` is `(err, address, family)` or, when `options.all` is set,
 * `(err, [{ address, family }])`.
 */
export type ConnectLookupCallback = (
  err: Error | null,
  address?: string | ResolvedAddress[],
  family?: number,
) => void;
export type ConnectLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: ConnectLookupCallback,
) => void;

/** Builds the dispatcher that pins a fetch's connection to the vetted IPs. */
export type DispatcherFactory = (addresses: ResolvedAddress[], hostname: string) => unknown;

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  maxRedirects?: number;
  perHopTimeoutMs?: number;
  totalTimeoutMs?: number;
  maxBytes?: number;
  /** Case-insensitive content-type prefixes; omit to allow any. */
  allowedContentTypes?: string[];
  lookup?: DnsLookup;
  fetchImpl?: typeof fetch;
  /** Overridable for tests; defaults to a connection-pinning undici Agent. */
  dispatcherFactory?: DispatcherFactory;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  headers: Headers;
  contentType: string;
  body: Buffer;
}

const defaultLookup: DnsLookup = (hostname) =>
  nodeLookup(hostname, { all: true }) as Promise<ResolvedAddress[]>;

/** Resolve a host and reject if ANY resolved address is disallowed; returns the vetted set. */
async function guardHost(host: string, lookup: DnsLookup): Promise<ResolvedAddress[]> {
  let addrs: ResolvedAddress[];
  try {
    addrs = await lookup(host);
  } catch {
    throw new SsrfError('The host could not be resolved');
  }
  if (!addrs || addrs.length === 0) throw new SsrfError('The host could not be resolved');
  for (const a of addrs) {
    if (isBlockedAddress(a.address)) {
      throw new SsrfError('The host resolves to a disallowed address');
    }
  }
  return addrs;
}

/**
 * Build a connect-time lookup that ALWAYS returns the pre-vetted address(es),
 * ignoring the hostname it is called with. This is what defeats DNS rebinding:
 * `guardHost` validated these exact IPs, and this pins the socket to them so
 * undici cannot re-resolve to a fresh (possibly blocked) address at connect
 * time. It also re-checks the addresses as belt-and-suspenders before dialing.
 */
export function createPinnedLookup(addresses: ResolvedAddress[]): ConnectLookup {
  return (_hostname, options, callback) => {
    for (const a of addresses) {
      if (isBlockedAddress(a.address)) {
        callback(new SsrfError('The host resolves to a disallowed address'));
        return;
      }
    }
    if (options && options.all) {
      callback(null, addresses.map((a) => ({ address: a.address, family: a.family })));
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  };
}

const defaultDispatcherFactory: DispatcherFactory = (addresses) =>
  new Agent({ connect: { lookup: createPinnedLookup(addresses) as never } });

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new SsrfError('The response is too large');
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      throw new SsrfError('The request timed out or the connection failed');
    }
    if (chunk.done) break;
    total += chunk.value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SsrfError('The response is too large');
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Fetch a URL under the full SSRF policy: scheme + credential + per-hop DNS/IP
 * checks, manual redirect following, and body-size / content-type / time caps.
 * Throws SsrfError (safe message) on any violation or transport failure.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? 5;
  const perHopTimeoutMs = opts.perHopTimeoutMs ?? 10_000;
  const totalTimeoutMs = opts.totalTimeoutMs ?? 20_000;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const lookup = opts.lookup ?? defaultLookup;
  const doFetch = opts.fetchImpl ?? fetch;
  const dispatcherFactory = opts.dispatcherFactory ?? defaultDispatcherFactory;
  const deadline = Date.now() + totalTimeoutMs;
  const dispatchers: unknown[] = [];

  try {
    return await runHops();
  } finally {
    for (const d of dispatchers) {
      const closable = d as { close?: () => unknown };
      if (closable && typeof closable.close === 'function') {
        try {
          await closable.close();
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  }

  async function runHops(): Promise<SafeFetchResult> {
  let current = normalizeUrl(rawUrl);
  const visited = new Set<string>([current.toString()]);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Re-validate scheme/credentials on every hop (redirects can change them).
    if (!ALLOWED_SCHEMES.has(current.protocol)) throw new SsrfError('Only http and https URLs are allowed');
    if (current.username || current.password) throw new SsrfError('URLs with embedded credentials are not allowed');

    // Re-resolve DNS and guard the resolved IPs for THIS hop.
    const hostname = stripBrackets(current.hostname);
    const vetted = await guardHost(hostname, lookup);

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SsrfError('The request timed out');

    // Pin the connection to the exact IP(s) we just validated so undici cannot
    // re-resolve (and rebind) the hostname at connect time.
    const dispatcher = dispatcherFactory(vetted, hostname);
    if (dispatcher) dispatchers.push(dispatcher);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(perHopTimeoutMs, remaining));
    let res: Response;
    try {
      const init: RequestInit & { dispatcher?: unknown } = {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        body: opts.body,
        redirect: 'manual',
        signal: controller.signal,
        dispatcher,
      };
      res = await doFetch(current.toString(), init as RequestInit);
    } catch {
      if (controller.signal.aborted) throw new SsrfError('The request timed out');
      throw new SsrfError('Unable to fetch the requested URL');
    } finally {
      clearTimeout(timer);
    }

    // Manual redirect handling — re-check the target on the next loop.
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel().catch(() => {});
      if (hop >= maxRedirects) throw new SsrfError('Too many redirects');
      let next: URL;
      try {
        next = normalizeUrl(new URL(res.headers.get('location')!, current).toString());
      } catch {
        throw new SsrfError('The redirect target is not allowed');
      }
      const key = next.toString();
      if (visited.has(key)) throw new SsrfError('A redirect loop was detected');
      visited.add(key);
      current = next;
      continue;
    }

    const contentType = res.headers.get('content-type') || '';
    if (opts.allowedContentTypes && opts.allowedContentTypes.length > 0) {
      const ct = contentType.toLowerCase();
      if (!opts.allowedContentTypes.some((p) => ct.startsWith(p.toLowerCase()))) {
        await res.body?.cancel().catch(() => {});
        throw new SsrfError('The response content type is not allowed');
      }
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      await res.body?.cancel().catch(() => {});
      throw new SsrfError('The response is too large');
    }

    // Bound the body read by the overall deadline.
    const bodyRemaining = deadline - Date.now();
    const bodyTimer = setTimeout(() => controller.abort(), Math.max(0, bodyRemaining));
    try {
      const body = await readCapped(res, maxBytes);
      return { url: current.toString(), status: res.status, headers: res.headers, contentType, body };
    } finally {
      clearTimeout(bodyTimer);
    }
  }

  throw new SsrfError('Too many redirects');
  }
}
