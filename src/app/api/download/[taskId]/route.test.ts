import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function call(taskId: string, format?: string) {
  const qs = format === undefined ? '' : `?format=${encodeURIComponent(format)}`;
  const req = new NextRequest(`http://localhost/api/download/x${qs}`);
  return GET(req, { params: Promise.resolve({ taskId }) });
}

describe('GET /api/download/[taskId]', () => {
  it('rejects a format outside the {glb,usdz} allowlist without calling the backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not fetch'));
    const res = await call('task123', 'exe');
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/exe|localhost|8080|backend returned/i);
  });

  it('percent-encodes the taskId into the backend URL (no path/query injection)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('GLB', { status: 200, headers: { 'content-type': 'model/gltf-binary' } }),
    );
    await call('../../secret?x=1&y=2', 'glb');
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain(encodeURIComponent('../../secret?x=1&y=2'));
    expect(url).not.toContain('/download/../../secret');
    expect(url.endsWith('?format=glb')).toBe(true);
  });

  it('passes an AbortSignal (bounded total timeout) to the backend fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('GLB', { status: 200, headers: { 'content-type': 'model/gltf-binary' } }),
    );
    await call('task123', 'glb');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('caps an oversized upstream body and returns a generic error', async () => {
    vi.stubEnv('MODEL_DOWNLOAD_MAX_BYTES', '8');
    const big = new Uint8Array(1024).fill(65);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(big);
        c.close();
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'content-type': 'model/gltf-binary' } }),
    );
    const res = await call('task123', 'glb');
    expect(res.status).toBeGreaterThanOrEqual(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/too large|8080|localhost|abcd/i);
  });

  it('returns a generic error carrying no backend internals when the upstream fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('internal stack trace: NPE at Backend.java:42', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    );
    const res = await call('task123', 'glb');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/backend returned|stack|NPE|Backend\.java|localhost|8080/i);
    expect(body.error).toBe('The model could not be downloaded right now.');
  });
});
