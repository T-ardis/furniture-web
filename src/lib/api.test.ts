import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadModel } from './api';

afterEach(() => vi.restoreAllMocks());

// A non-GLB payload (ZIP/USDZ "PK" magic) so the GLB magic-byte check fails.
function nonGlbResponse() {
  return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), {
    status: 200,
    headers: { 'content-type': 'model/vnd.usdz+zip' },
  });
}

describe('downloadModel — truthful errors', () => {
  it('throws a user-safe message with no internal ops commands when GLB is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => nonGlbResponse());

    await expect(downloadModel('task-123', 'glb')).rejects.toThrow();

    let message = '';
    try {
      await downloadModel('task-123', 'glb');
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).not.toMatch(/modal|git push|deploy|backend\/modal_app|cd tardis/i);
    expect(message.length).toBeGreaterThan(0);
  });
});
