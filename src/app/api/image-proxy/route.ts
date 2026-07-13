import { NextRequest, NextResponse } from 'next/server';
import { safeFetch, SsrfError } from '@/lib/ssrf';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
  'image/avif', 'image/heic', 'image/heif', 'image/svg+xml', 'image/',
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing "url" param' }, { status: 400 });
  }

  try {
    const res = await safeFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      allowedContentTypes: ['image/'],
      perHopTimeoutMs: 15_000,
      totalTimeoutMs: 20_000,
      maxBytes: 15 * 1024 * 1024,
    });

    if (res.status < 200 || res.status >= 300) {
      return NextResponse.json({ error: 'The image could not be loaded.' }, { status: 502 });
    }

    // Only echo a known image content-type; never pass an upstream type verbatim.
    const upstream = res.contentType.split(';')[0].trim().toLowerCase();
    const contentType = ALLOWED_IMAGE_TYPES.includes(upstream) ? upstream : 'image/jpeg';

    return new NextResponse(new Uint8Array(res.body), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'The image could not be loaded.' }, { status: 502 });
  }
}
