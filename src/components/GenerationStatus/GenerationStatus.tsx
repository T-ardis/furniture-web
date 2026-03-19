'use client';

import type { GenerationPhase } from '@/hooks/useGeneration';
import styles from './GenerationStatus.module.css';

interface Props {
  phase: GenerationPhase;
  progress: number;
  error: string | null;
  onRetry?: () => void;
}

const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: '',
  submitting: 'Submitting job...',
  generating: 'Generating 3D model',
  downloading: 'Downloading model...',
  ready: 'Model ready!',
  failed: 'Generation failed',
};

export default function GenerationStatus({ phase, progress, error, onRetry }: Props) {
  if (phase === 'idle' || phase === 'ready') return null;

  const label = PHASE_LABELS[phase];
  const isActive = phase === 'submitting' || phase === 'generating' || phase === 'downloading';

  return (
    <div className={styles.container}>
      <div className={styles.statusRow}>
        {isActive && <div className={styles.spinner} />}
        {phase === 'failed' && <div className={styles.errorIcon}>!</div>}
        <div className={styles.text}>
          <span className={styles.label}>{label}</span>
          {phase === 'generating' && progress > 0 && (
            <span className={styles.percent}>{progress}%</span>
          )}
        </div>
      </div>

      {isActive && (
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{ width: `${phase === 'submitting' ? 5 : phase === 'downloading' ? 95 : progress}%` }}
          />
        </div>
      )}

      {phase === 'generating' && (
        <p className={styles.hint}>
          This typically takes 2-5 minutes. You can prepare your room photo while you wait.
        </p>
      )}

      {phase === 'failed' && error && (
        <div className={styles.errorBlock}>
          <p className={styles.errorMsg}>{error}</p>
          {onRetry && (
            <button className={styles.retryBtn} onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
