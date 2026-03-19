'use client';

import { useCallback, useRef, useState } from 'react';
import {
  submitGeneration,
  pollStatus,
  downloadModel,
  getDownloadUrl,
  type JobStatusType,
} from '@/lib/api';

export type GenerationPhase =
  | 'idle'
  | 'submitting'
  | 'generating'
  | 'downloading'
  | 'ready'
  | 'failed';

interface GenerationState {
  phase: GenerationPhase;
  taskId: string | null;
  progress: number;
  error: string | null;
  modelBlobUrl: string | null;
  modelBlob: Blob | null;
  usdzUrl: string | null;
}

export default function useGeneration() {
  const [state, setState] = useState<GenerationState>({
    phase: 'idle',
    taskId: null,
    progress: 0,
    error: null,
    modelBlobUrl: null,
    modelBlob: null,
    usdzUrl: null,
  });

  const abortRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    abortRef.current = true;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setState({
      phase: 'idle',
      taskId: null,
      progress: 0,
      error: null,
      modelBlobUrl: null,
      modelBlob: null,
      usdzUrl: null,
    });
  }, []);

  const generate = useCallback(async (imageBase64: string) => {
    abortRef.current = false;
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;

    setState({
      phase: 'submitting',
      taskId: null,
      progress: 0,
      error: null,
      modelBlobUrl: null,
      modelBlob: null,
      usdzUrl: null,
    });

    try {
      // Submit
      const { task_id } = await submitGeneration(imageBase64);
      if (abortRef.current) return;

      setState(s => ({ ...s, phase: 'generating', taskId: task_id }));

      // Poll
      let status: JobStatusType = 'pending';
      while (status !== 'finished' && status !== 'failed') {
        await new Promise(r => setTimeout(r, 5000));
        if (abortRef.current) return;

        const job = await pollStatus(task_id);
        status = job.status;
        setState(s => ({ ...s, progress: job.progress }));

        if (job.status === 'failed') {
          throw new Error(job.error || 'Generation failed');
        }
      }

      if (abortRef.current) return;

      // Download GLB for web 3D viewer
      setState(s => ({ ...s, phase: 'downloading', progress: 100 }));
      const blob = await downloadModel(task_id, 'glb');
      if (abortRef.current) return;

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      // USDZ URL for iOS AR Quick Look (served directly by backend)
      const usdzUrl = getDownloadUrl(task_id, 'usdz');

      setState(s => ({
        ...s,
        phase: 'ready',
        modelBlobUrl: url,
        modelBlob: blob,
        usdzUrl,
      }));
    } catch (err) {
      if (abortRef.current) return;
      setState(s => ({
        ...s,
        phase: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  return { ...state, generate, reset };
}
