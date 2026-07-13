import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

const cfg = getConfig();
const API_URL = cfg.apiUrl;
const API_KEY = cfg.apiKey;

/**
 * GET /api/download/:taskId?format=usdz
 *
 * Proxies the model download from the Render backend, injecting the API key.
 * iOS Quick Look fetches ios-src directly (no custom headers), so this proxy
 * is needed for AR to work.
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

  const url = `${API_URL}/download/${taskId}${format ? `?format=${format}` : ''}`;

  const res = await fetch(url, {
    headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Backend returned ${res.status}` },
      { status: res.status },
    );
  }

  const blob = await res.blob();
  const contentType = format === 'usdz'
    ? 'model/vnd.usdz+zip'
    : 'model/gltf-binary';

  return new NextResponse(blob, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="model.${format || 'glb'}"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
