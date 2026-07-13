import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST } from './route';

function scrapeReq(body: unknown) {
  return new Request('http://localhost/api/scrape', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    // @ts-expect-error NextRequest-compatible shape for the handler
  });
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/scrape SSRF guard', () => {
  it('rejects the cloud metadata address without any upstream fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked in test'));
    const res = await POST(scrapeReq({ url: 'http://169.254.169.254/latest/meta-data/' }) as never);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(fetchSpy).not.toHaveBeenCalled();
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/169\.254|meta-data|localhost|8080|ECONN|stack/i);
  });

  it('rejects a loopback address without any upstream fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked in test'));
    const res = await POST(scrapeReq({ url: 'http://127.0.0.1:8080/admin' }) as never);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-http scheme', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked in test'));
    const res = await POST(scrapeReq({ url: 'file:///etc/passwd' }) as never);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when url is missing', async () => {
    const res = await POST(scrapeReq({}) as never);
    expect(res.status).toBe(400);
  });
});
