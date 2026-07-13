import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { readCapped } from '@/lib/ssrf';

const cfg = getConfig();
const API_URL = cfg.apiUrl;
const API_KEY = cfg.apiKey;

const ALLOWED_FORMATS = new Set(['glb', 'usdz']);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024; // 100 MB — a textured GLB/USDZ ceiling.

const GENERIC_ERROR = 'The model could not be downloaded right now.';

function numFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * GET /api/download/:taskId?format=glb|usdz
 *
 * Proxies the model download from the trusted tardis backend, injecting the API
 * key. iOS Quick Look fetches ios-src directly (no custom headers), so this
 * proxy is needed for AR to work.
 *
 * The backend is a fixed, trusted host (no SSRF/content-type checks needed), but
 * the call is still bounded by a total timeout and a body-size cap, and the
 * task id / format are validated so nothing untrusted is interpolated raw into
 * the upstream URL. Upstream failures surface a generic, user-safe message —
 * the real status is logged server-side only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const format = req.nextUrl.searchParams.get('format') || '';

  if (!API_URL) {
    return NextResponse.json(
      { error: 'The model service is not available right now.' },
      { status: 503 },
    );
  }

  if (format && !ALLOWED_FORMATS.has(format)) {
    return NextResponse.json({ error: 'Unsupported model format.' }, { status: 400 });
  }

  const query = format ? `?format=${format}` : '';
  const url = `${API_URL}/download/${encodeURIComponent(taskId)}${query}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
      signal: AbortSignal.timeout(numFromEnv('MODEL_DOWNLOAD_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)),
    });
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 504 });
  }

  if (!res.ok) {
    console.error(`download proxy: backend returned ${res.status} for task ${taskId}`);
    await res.body?.cancel().catch(() => {});
    return NextResponse.json({ error: GENERIC_ERROR }, { status: res.status });
  }

  let body: Buffer;
  try {
    body = await readCapped(res, numFromEnv('MODEL_DOWNLOAD_MAX_BYTES', DEFAULT_MAX_BYTES));
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }

  const contentType = format === 'usdz' ? 'model/vnd.usdz+zip' : 'model/gltf-binary';

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="model.${format || 'glb'}"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
