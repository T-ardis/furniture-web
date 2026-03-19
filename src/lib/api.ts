const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

function headers(extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type JobStatusType = 'pending' | 'processing' | 'finished' | 'failed';

export interface GenerateResponse {
  task_id: string;
}

export interface JobStatus {
  task_id: string;
  status: JobStatusType;
  progress: number;
  error?: string | null;
}

export interface RoomPreviewResponse {
  preview_image: string;
}

export interface ResearchResultItem {
  title: string;
  url: string;
  image_url: string;
  price: string | null;
  retailer: string;
  source: string;
  snippet: string;
}

export interface ResearchResponse {
  results: ResearchResultItem[];
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function submitGeneration(
  imageBase64: string,
  opts?: { steps?: number; seed?: number; face_count?: number },
): Promise<GenerateResponse> {
  const res = await fetch(`${API_URL}/generate/async`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      image: imageBase64,
      steps: opts?.steps ?? 5,
      seed: opts?.seed ?? 1234,
      face_count: opts?.face_count ?? 40000,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Generation submit failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function pollStatus(taskId: string): Promise<JobStatus> {
  const res = await fetch(`${API_URL}/status/${taskId}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Status poll failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function getDownloadUrl(taskId: string, format?: 'glb' | 'usdz'): string {
  // USDZ: use Next.js proxy so iOS Quick Look gets the API key injected server-side
  if (format === 'usdz') {
    return `/api/download/${taskId}?format=usdz`;
  }
  const base = `${API_URL}/download/${taskId}`;
  return format ? `${base}?format=${format}` : base;
}

/** GLB magic bytes: "glTF" */
const GLB_MAGIC = 0x46546C67;

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, {
    headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Download failed (${res.status}): ${text}`);
  }
  return res.blob();
}

function isGlb(blob: Blob): Promise<boolean> {
  return blob.slice(0, 4).arrayBuffer().then(buf => {
    return new DataView(buf).getUint32(0, true) === GLB_MAGIC;
  });
}

export async function downloadModel(taskId: string, format: 'glb' | 'usdz' = 'glb'): Promise<Blob> {
  // 1. Try requesting the specific format (new backend)
  try {
    const blob = await fetchBlob(getDownloadUrl(taskId, format));
    if (format === 'glb' && await isGlb(blob)) return blob;
    if (format === 'usdz') return blob;
  } catch { /* new endpoint not available, fall through */ }

  // 2. Fallback: download default (old backend) and check what we got
  const blob = await fetchBlob(getDownloadUrl(taskId));
  if (format === 'glb' && await isGlb(blob)) return blob;

  // 3. If we got USDZ but wanted GLB, try to extract GLB from inside the USDZ (ZIP)
  // USDZ is a ZIP containing .usdc — no embedded GLB, so we can't convert client-side.
  // Return the blob as-is; model-viewer will show an error but at least won't crash.
  if (format === 'glb' && !await isGlb(blob)) {
    throw new Error(
      'GLB format not available yet. The backend needs to be redeployed. ' +
      'Run: cd tardis && git push (backend) && modal deploy backend/modal_app/app.py (Modal)'
    );
  }

  return blob;
}

export async function generateRoomPreview(
  roomImageBase64: string,
  productImageBase64: string,
  productName: string,
): Promise<RoomPreviewResponse> {
  const res = await fetch(`${API_URL}/preview/room`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      room_image: roomImageBase64,
      product_image: productImageBase64,
      product_name: productName,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Room preview failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function findSimilar(
  imageBase64: string,
  name: string,
  category: string,
): Promise<ResearchResponse> {
  const res = await fetch(`${API_URL}/research/similar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ image: imageBase64, name, category }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Research failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Stream similar items via SSE — calls onBatch for each retailer that completes.
 * Returns a cleanup function to abort the stream.
 */
export function findSimilarStream(
  imageBase64: string,
  name: string,
  category: string,
  onBatch: (items: ResearchResultItem[]) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/research/similar/stream`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ image: imageBase64, name, category }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        onError(`Research failed (${res.status}): ${text}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { onError('No stream body'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: done')) {
            onDone();
            return;
          }
          if (line.startsWith('event: error')) {
            continue; // next line has the data
          }
          if (line.startsWith('data: ')) {
            const json = line.slice(6);
            try {
              const parsed = JSON.parse(json);
              if (parsed.error) {
                onError(parsed.error);
              } else if (Array.isArray(parsed) && parsed.length > 0) {
                onBatch(parsed as ResearchResultItem[]);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
      onDone();
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(err instanceof Error ? err.message : 'Stream failed');
    }
  })();

  return () => controller.abort();
}

// ── Utilities ────────────────────────────────────────────────────────────────

export function imageToBase64(file: File, maxSide = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resizeImageSrc(reader.result as string, maxSide).then(resolve).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function urlToBase64(url: string, maxSide = 512): Promise<string> {
  // If it's already a data URL, resize directly
  if (url.startsWith('data:')) {
    return resizeImageSrc(url, maxSide);
  }
  // If it's a blob URL, fetch and convert
  if (url.startsWith('blob:')) {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return resizeImageSrc(dataUrl, maxSide);
  }
  // External URL: fetch through a proxy or directly
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return resizeImageSrc(dataUrl, maxSide);
}

function resizeImageSrc(src: string, maxSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = reject;
    img.src = src;
  });
}
