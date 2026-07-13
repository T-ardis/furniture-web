// Deterministic local cross-repo B2B end-to-end scenario (design §9).
//
// Boots the REAL services locally — no cloud, no GPU, no paid API, no Postgres:
//   - tardis backend      (B2B mock generation, SQLite jobs, local FS object +
//                          edge stores, file-backed tenant keys)
//   - tardis-edge         resolver + collector, reading the SAME local dirs the
//                          backend publisher/tenant-store write (localfile stores)
//   - tardis-embed        the real loader + viewer, driven in headless Chromium
//                          against a served PDP wired to the real edge
//
// and drives §9 steps 2-9 + 11 across real process/browser boundaries, asserting
// each. Steps 1 and 10 (tenant credits + exactly-once refund) live in
// tardis-admin/Postgres and are proven by its live-Postgres integration suite
// (credits.concurrency / generation.integration / refund.integration); they are
// referenced here, not re-run (this harness is Postgres-free by design).
//
// Exit 0 iff every in-scope step passes. Run: `npm run scenario:verify`.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  mkdtempSync, mkdirSync, readFileSync, existsSync, statSync,
  createReadStream, openSync, writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import net from 'node:net';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');            // furniture-web
const WS = resolve(REPO, '..');              // .worktrees/contracts-v1
const BACKEND = join(WS, 'tardis', 'backend');
const EDGE = join(WS, 'tardis-edge');
const EMBED = join(WS, 'tardis-embed');
const CONTRACTS = join(REPO, 'contracts', 'v1');

const BACKEND_PY = join(BACKEND, 'venv', 'bin', 'python');
const EDGE_PY = join(EDGE, '.venv', 'bin', 'python');

// ─── tiny utils ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const token = () => crypto.randomBytes(16).toString('hex');

function log(msg) { process.stdout.write(msg + '\n'); }
function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

async function waitForHttp(url, { timeout = 45000, label = url } = {}) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for ${label} (${url})`);
    await sleep(250);
  }
}

// Minimal valid RGB PNG (no deps) so the backend's Pillow validation passes.
function makePngBase64(size = 64) {
  const crc32 = (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      let c = (crc ^ buf[i]) & 0xff;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const tb = Buffer.from(type, 'ascii');
    const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
    return Buffer.concat([len, tb, data, cb]);
  };
  const w = size, h = size;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 (RGB)
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = 176; row[1 + x * 3 + 1] = 140; row[1 + x * 3 + 2] = 100; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return png.toString('base64');
}

// HTTP helpers (Node fetch; Origin header is settable here, unlike a browser).
async function jget(url, headers = {}) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: r.status, ok: r.ok, json, text, headers: r.headers };
}
async function jpost(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: r.status, ok: r.ok, json, text };
}

// ─── process + server management ─────────────────────────────────────────────
const procs = [];
let staticServer = null;
let browser = null;

function launch(name, cmd, args, { cwd, env, logPath }) {
  const fd = openSync(logPath, 'a');
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd] });
  child.on('exit', (code, sig) => {
    if (!shuttingDown && code !== 0 && code !== null) {
      log(`  ⚠️  ${name} exited early (code=${code} sig=${sig}); see ${logPath}`);
    }
  });
  procs.push({ name, child, logPath });
  return child;
}

let shuttingDown = false;
async function teardown() {
  shuttingDown = true;
  try { if (browser) await browser.close(); } catch { /* */ }
  try { if (staticServer) staticServer.close(); } catch { /* */ }
  for (const { child } of procs) { try { child.kill('SIGKILL'); } catch { /* */ } }
}
process.on('SIGINT', async () => { await teardown(); process.exit(130); });

function tail(logPath, n = 25) {
  try {
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    return lines.slice(-n).map((l) => '    │ ' + l).join('\n');
  } catch { return '    │ (no log)'; }
}

// ─── the run ─────────────────────────────────────────────────────────────────
const CTYPE = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html',
  '.css': 'text/css', '.json': 'application/json', '.map': 'application/json',
  '.glb': 'model/gltf-binary', '.usdz': 'model/vnd.usdz+zip', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

const results = [];
function record(step, name, ok, detail) {
  results.push({ step, name, ok, detail });
  log(`  ${ok ? '✓' : '✗'} Step ${step} — ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) throw new Error(`Step ${step} failed: ${name} — ${detail}`);
}

async function main() {
  log('\n▶ TARDIS B2B local end-to-end scenario (design §9, steps 2-9 + 11)\n');

  // Preconditions
  for (const [p, what] of [[BACKEND_PY, 'backend venv'], [EDGE_PY, 'edge venv'], [join(EMBED, 'dist', 'embed.js'), 'embed dist']]) {
    if (!existsSync(p)) throw new Error(`missing ${what}: ${p} (build/install it first)`);
  }

  const run = mkdtempSync(join(tmpdir(), 'tardis-e2e-'));
  const dirs = {
    edge: join(run, 'edge'), keys: join(run, 'keys'), assets: join(run, 'assets'), logs: join(run, 'logs'),
  };
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
  const jobsDb = join(run, 'jobs.db');
  const eventsJsonl = join(run, 'events.jsonl');
  log(`  workspace: ${run}`);

  const [BPORT, RPORT, CPORT, EPORT] = await Promise.all([freePort(), freePort(), freePort(), freePort()]);
  const ADMIN = token();
  const ORIGIN = `http://localhost:${EPORT}`;          // the PDP page origin
  const RESOLVER = `http://localhost:${RPORT}`;
  const COLLECTOR = `http://localhost:${CPORT}`;
  const BACKEND_URL = `http://localhost:${BPORT}`;

  const keys = {
    pkA: 'pk_e2e_orga', skA: 'sk_e2e_orga',
    pkB: 'pk_e2e_orgb', skB: 'sk_e2e_orgb',
    pkA2: 'pk_e2e_orga_rot',
  };

  // ── boot backend ──────────────────────────────────────────────────────────
  log('\n  Booting services…');
  launch('backend', BACKEND_PY, ['server.py', '--port', String(BPORT)], {
    cwd: BACKEND,
    logPath: join(dirs.logs, 'backend.log'),
    env: {
      PORT: String(BPORT), API_KEY: '',
      B2B_ENABLED: 'true', B2B_MOCK_GENERATION: 'true', B2B_ADMIN_TOKEN: ADMIN,
      JOBSTORE_BACKEND: 'sql', JOBSTORE_DB_URL: `sqlite:///${jobsDb}`,
      OBJECT_STORAGE_BACKEND: 'local', OBJECT_STORAGE_DIR: dirs.assets,
      OBJECT_STORAGE_PUBLIC_URL: `${ORIGIN}/assets`,   // served same-origin as the PDP via the static proxy
      EDGE_PUBLISHER_BACKEND: 'local', EDGE_PUBLISH_DIR: dirs.edge,
      TENANT_STORE_BACKEND: 'file', TENANT_STORE_DIR: dirs.keys,
      TASK_QUEUE_BACKEND: 'local',
    },
  });

  // ── boot edge resolver + collector (read the SAME local dirs) ───────────────
  launch('resolver', EDGE_PY, ['-m', 'uvicorn', 'resolver.main:app', '--port', String(RPORT)], {
    cwd: EDGE,
    logPath: join(dirs.logs, 'resolver.log'),
    env: {
      TARDIS_ENV: 'development',
      RESOLUTION_STORE_BACKEND: 'localfile', RESOLUTION_STORE_DIR: dirs.edge,
      KEY_STORE_BACKEND: 'localfile', KEY_STORE_DIR: dirs.keys,
    },
  });
  launch('collector', EDGE_PY, ['-m', 'uvicorn', 'collector.main:app', '--port', String(CPORT)], {
    cwd: EDGE,
    logPath: join(dirs.logs, 'collector.log'),
    env: {
      TARDIS_ENV: 'development',
      KEY_STORE_BACKEND: 'localfile', KEY_STORE_DIR: dirs.keys,
      EVENT_SINK_BACKEND: 'jsonl', EVENT_SINK_PATH: eventsJsonl,
    },
  });

  // ── static PDP server (serves embed dist + proxies /assets to the backend) ──
  const pdpHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>E2E PDP — HAVEN</title></head>
<body style="font-family:system-ui;margin:40px">
<h1>Halden Sectional — E2E test PDP</h1>
<button id="trigger" data-tardis data-product="sku-1" data-mode="object">View in your room</button>
<script src="/dist/embed.js" defer
  data-tardis-key="${keys.pkA}"
  data-tardis-api="${RESOLVER}"
  data-tardis-collector="${COLLECTOR}"></script>
</body></html>`;

  staticServer = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, ORIGIN);
      if (u.pathname === '/pdp.html' || u.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' }); res.end(pdpHtml); return;
      }
      if (u.pathname.startsWith('/assets/')) {
        const up = await fetch(`${BACKEND_URL}${u.pathname}${u.search}`);
        const buf = Buffer.from(await up.arrayBuffer());
        res.writeHead(up.status, {
          'content-type': up.headers.get('content-type') || 'application/octet-stream',
          'access-control-allow-origin': '*',
        });
        res.end(buf); return;
      }
      const fp = join(EMBED, u.pathname);
      if (fp.startsWith(EMBED) && existsSync(fp) && statSync(fp).isFile()) {
        res.writeHead(200, { 'content-type': CTYPE[extname(fp)] || 'application/octet-stream', 'access-control-allow-origin': '*' });
        createReadStream(fp).pipe(res); return;
      }
      res.writeHead(404); res.end('not found');
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  await new Promise((r) => staticServer.listen(EPORT, '127.0.0.1', r));

  await Promise.all([
    waitForHttp(`${BACKEND_URL}/health`, { label: 'backend' }),
    waitForHttp(`${RESOLVER}/healthz`, { label: 'resolver' }),
    waitForHttp(`${COLLECTOR}/healthz`, { label: 'collector' }),
    waitForHttp(`${ORIGIN}/pdp.html`, { label: 'static PDP' }),
  ]);
  log('  All services healthy.\n');

  const adminH = { 'X-B2B-Admin-Token': ADMIN };
  const skAH = { 'X-Tenant-Key': keys.skA };

  // ── STEP 2 — provision keys + allowed origin (backend admin token) ──────────
  {
    const rA = await jpost(`${BACKEND_URL}/b2b/tenant/provision`, {
      orgId: 'org_a',
      upserts: [
        { key: keys.pkA, orgId: 'org_a', allowedOrigins: [ORIGIN] },
        { key: keys.skA, orgId: 'org_a', allowedOrigins: [] },
      ],
      revocations: [],
    }, adminH);
    const rB = await jpost(`${BACKEND_URL}/b2b/tenant/provision`, {
      orgId: 'org_b',
      upserts: [
        { key: keys.pkB, orgId: 'org_b', allowedOrigins: [ORIGIN] },
        { key: keys.skB, orgId: 'org_b', allowedOrigins: [] },
      ],
      revocations: [],
    }, adminH);
    const ok = rA.status === 200 && rB.status === 200 &&
      rA.json?.provisioned?.includes(keys.pkA) && rB.json?.provisioned?.includes(keys.pkB);
    record(2, 'provision pk_/sk_ + origin (org_a & org_b)', ok, `orgA=${rA.status} orgB=${rB.status}`);
  }

  // ── STEP 3 — safe source upload (sk_) ───────────────────────────────────────
  let sourceRef;
  {
    const r = await jpost(`${BACKEND_URL}/b2b/source/upload`, {
      filename: 'source.png', contentType: 'image/png', data: makePngBase64(64),
    }, skAH);
    sourceRef = r.json?.sourceAssetRef;
    record(3, 'upload + sanitize source image', r.status === 200 && !!sourceRef, `ref=${sourceRef}`);
  }

  // ── STEP 4 — double-submit same idempotency key → exactly one job ───────────
  let taskId;
  {
    const idem = uuid();
    const idemH = { ...skAH, 'Idempotency-Key': idem };
    const body = { productId: 'sku-1', name: 'E2E Chair', mode: 'object', sourceAssetRef: sourceRef };
    const r1 = await jpost(`${BACKEND_URL}/b2b/generate/async`, body, idemH);
    const r2 = await jpost(`${BACKEND_URL}/b2b/generate/async`, body, idemH);
    taskId = r1.json?.taskId;
    const ok = r1.status === 200 && r2.status === 200 &&
      r1.json?.status === 'pending' && taskId && r2.json?.taskId === taskId;
    record(4, 'idempotent generate (one job on duplicate submit)', ok, `taskId=${taskId} dup=${r2.json?.taskId}`);
  }

  // ── STEP 5 — mock generation → store GLB/USDZ/poster → publish ──────────────
  let published;
  {
    const t0 = Date.now();
    let st;
    for (;;) {
      st = await jget(`${BACKEND_URL}/b2b/status/${taskId}`, skAH);
      if (st.json?.status === 'finished' || st.json?.status === 'failed') break;
      if (Date.now() - t0 > 30000) break;
      await sleep(300);
    }
    const j = st.json || {};
    const assetsOk = j.status === 'finished' && j.modelUrl && j.usdzUrl && j.posterUrl;
    // the published asset must actually be fetchable (via the static /assets proxy)
    let bytesOk = false;
    if (assetsOk) {
      const g = await fetch(j.modelUrl);
      bytesOk = g.ok && Number(g.headers.get('content-length') || (await g.arrayBuffer()).byteLength) > 0;
    }
    published = j;
    record(5, 'worker stores GLB/USDZ/poster + publishes resolution', assetsOk && bytesOk,
      `status=${j.status} model=${j.modelUrl ? 'set' : 'null'} fetch=${bytesOk}`);
  }

  // ── STEP 6 — resolve THROUGH the edge (allow / deny origin / cross-tenant) ──
  {
    const allow = await jget(`${RESOLVER}/resolve?product=sku-1&key=${keys.pkA}`, { Origin: ORIGIN });
    const deny = await jget(`${RESOLVER}/resolve?product=sku-1&key=${keys.pkA}`, { Origin: 'https://evil.example.com' });
    const cross = await jget(`${RESOLVER}/resolve?product=sku-1&key=${keys.pkB}`, { Origin: ORIGIN });
    const canonical = allow.json?.modelUrl === published.modelUrl && allow.json?.usdzUrl === published.usdzUrl;
    const ok = allow.status === 200 && canonical && deny.status === 403 && cross.status === 404;
    record(6, 'edge resolve: allowed 200 / bad-origin 403 / cross-tenant 404', ok,
      `allow=${allow.status} canonical=${canonical} deny=${deny.status} cross=${cross.status}`);
  }

  // ── STEP 7 & 8 — embed opens (canonical asset) + enriched analytics ─────────
  {
    const require = createRequire(join(EMBED, 'package.json') + '/');
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const requested = [];
    const resolves = [];
    page.on('request', (r) => requested.push(r.url()));
    page.on('response', (r) => { if (r.url().includes(`:${RPORT}/resolve`)) resolves.push(r.status()); });
    page.on('pageerror', (e) => log(`    │ pageerror: ${e.message}`));

    await page.goto(`${ORIGIN}/pdp.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.Tardis !== undefined, null, { timeout: 8000 });
    await page.click('#trigger');
    await page.waitForRequest((r) => r.url().includes(`:${RPORT}/resolve`), { timeout: 8000 }).catch(() => {});
    // give the viewer time to fetch the model + emit ar_open / ar_view beacons
    await sleep(4000);

    const canonicalModel = published.modelUrl.replace(/^https?:\/\/[^/]+/, ORIGIN); // same value; assets are same-origin
    const resolvedOk = resolves.some((s) => s === 200);
    const assetRequested = requested.some((u) => u.includes('/assets/org_a/sku-1/v1/model.glb'));
    record(7, 'embed resolves via edge + loads the canonical asset', resolvedOk && assetRequested,
      `resolve200=${resolvedOk} assetReq=${assetRequested}`);

    // Poll the collector's JSONL sink for enriched events.
    let events = [];
    const t0 = Date.now();
    for (;;) {
      if (existsSync(eventsJsonl)) {
        events = readFileSync(eventsJsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
      }
      const hasOpen = events.some((e) => e.type === 'ar_open');
      const hasView = events.some((e) => e.type === 'ar_view');
      if (hasOpen && hasView) break;
      if (Date.now() - t0 > 8000) break;
      await sleep(300);
    }
    const open = events.find((e) => e.type === 'ar_open');
    const view = events.find((e) => e.type === 'ar_view');
    // Enrichment: orgId + origin are server-derived (never sent by the embed).
    const enriched = open && open.orgId === 'org_a' && open.origin === ORIGIN &&
      open.product === 'sku-1' && open.key === keys.pkA && typeof open.eventId === 'string';
    const viewOk = view && view.orgId === 'org_a' && view.origin === ORIGIN;
    record(8, 'collector receives enriched ar_open + ar_view (single-object fix)', !!enriched && !!viewOk,
      `ar_open=${open ? 'enriched' : 'MISSING'} ar_view=${view ? 'enriched' : 'MISSING'} count=${events.length}`);

    await browser.close(); browser = null;
  }

  // ── STEP 9 — surface catalog publish + resolve ──────────────────────────────
  {
    const fx = JSON.parse(readFileSync(join(CONTRACTS, 'resolution.surface.valid.json'), 'utf8'));
    const pub = await jpost(`${BACKEND_URL}/b2b/publish`, {
      productId: 'surf-1', name: fx.name || 'E2E Surface', mode: 'surface',
      surfaces: fx.surfaces, defaultSurfaceId: fx.defaultSurfaceId,
    }, skAH);
    const res = await jget(`${RESOLVER}/resolve?product=surf-1&key=${keys.pkA}`, { Origin: ORIGIN });
    const ok = pub.status === 200 && res.status === 200 && res.json?.mode === 'surface' &&
      Array.isArray(res.json?.surfaces) && res.json.surfaces.length > 0 &&
      res.json?.defaultSurfaceId === fx.defaultSurfaceId;
    record(9, 'surface catalog publish → edge resolve (multi-swatch)', ok,
      `publish=${pub.status} resolve=${res.status} swatches=${res.json?.surfaces?.length} default=${res.json?.defaultSurfaceId}`);
  }

  // ── STEP 11 — rotate the public key; the old key stops resolving at the edge ─
  {
    const rot = await jpost(`${BACKEND_URL}/b2b/tenant/provision`, {
      orgId: 'org_a',
      upserts: [{ key: keys.pkA2, orgId: 'org_a', allowedOrigins: [ORIGIN] }],
      revocations: [keys.pkA],
    }, adminH);
    const oldKey = await jget(`${RESOLVER}/resolve?product=sku-1&key=${keys.pkA}`, { Origin: ORIGIN });
    const newKey = await jget(`${RESOLVER}/resolve?product=sku-1&key=${keys.pkA2}`, { Origin: ORIGIN });
    const ok = rot.status === 200 && oldKey.status !== 200 && newKey.status === 200;
    record(11, 'key rotation revokes old key at the edge (live, no TTL)', ok,
      `rotate=${rot.status} old=${oldKey.status} new=${newKey.status}`);
  }

  log('\n  Steps 1 & 10 (tenant credits + exactly-once refund) are Postgres-owned');
  log('  and proven by tardis-admin `npm run test:db` (credits.concurrency /');
  log('  generation.integration / refund.integration); not re-run here.\n');
}

let exitCode = 0;
try {
  await main();
  log('✅ SCENARIO PASSED — all in-scope §9 steps green across real backend/edge/browser boundaries.');
} catch (err) {
  exitCode = 1;
  log(`\n❌ SCENARIO FAILED: ${err.message}`);
  const last = procs[procs.length - 1];
  for (const p of procs) {
    log(`\n  --- tail ${p.name} (${p.logPath}) ---\n${tail(p.logPath)}`);
  }
} finally {
  await teardown();
}

log('\n  Step results:');
for (const r of results) log(`    ${r.ok ? '✓' : '✗'} ${r.step}: ${r.name}`);
process.exit(exitCode);
