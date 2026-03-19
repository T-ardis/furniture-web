'use client';

import { useToast } from '@/components/Toast/ToastProvider';
import styles from './ShareModal.module.css';

interface Props {
  taskId: string;
  productName: string;
  onClose: () => void;
}

export default function ShareModal({ taskId, productName, onClose }: Props) {
  const { success } = useToast();

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?task=${taskId}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      success('Link copied to clipboard');
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      success('Link copied to clipboard');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${productName} — 3D Model`,
          text: `Check out this 3D furniture model: ${productName}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Share Model</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className={styles.description}>
          Share this link so others can view the 3D model of <strong>{productName}</strong>.
        </p>

        <div className={styles.urlRow}>
          <input
            type="text"
            className={styles.urlInput}
            value={shareUrl}
            readOnly
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button className={styles.copyBtn} onClick={handleCopy}>
            Copy
          </button>
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button className={styles.nativeShareBtn} onClick={handleNativeShare}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share via...
          </button>
        )}
      </div>
    </div>
  );
}
