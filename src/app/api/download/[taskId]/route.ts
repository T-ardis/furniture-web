import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

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
