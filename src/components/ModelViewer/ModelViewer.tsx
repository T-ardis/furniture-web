'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ModelViewer.module.css';

interface Props {
  src: string;
  iosSrc?: string;
  poster?: string;
  productName?: string;
  eyebrow?: string;
  headline?: string;
}

export default function ModelViewer({ src, iosSrc, poster, productName, eyebrow = '3D Preview', headline = 'Your model is <em>ready.</em>' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [arSupported, setArSupported] = useState(false);

  useEffect(() => {
    // Dynamically import model-viewer (web component, client-side only)
    import('@google/model-viewer').catch(() => {
      // model-viewer may already be registered
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mv = container.querySelector('model-viewer');
    if (!mv) return;

    const onLoad = () => setLoaded(true);
    mv.addEventListener('load', onLoad);

    // Check AR support
    const checkAr = () => {
      if ((mv as unknown as { canActivateAR: boolean }).canActivateAR) {
        setArSupported(true);
      }
    };
    mv.addEventListener('ar-status', checkAr);
    // Also check after a short delay (some browsers need time)
    const timer = setTimeout(checkAr, 1000);

    return () => {
      mv.removeEventListener('load', onLoad);
      mv.removeEventListener('ar-status', checkAr);
      clearTimeout(timer);
    };
  }, [src]);

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 className={styles.headline} dangerouslySetInnerHTML={{ __html: headline }} />

        <div ref={containerRef} className={styles.viewerWrap}>
          {!loaded && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
              <span>Loading 3D model...</span>
            </div>
          )}

          {/* @ts-expect-error model-viewer is a web component */}
          <model-viewer
            src={src}
            ios-src={iosSrc || undefined}
            poster={poster}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            environment-image="neutral"
            touch-action="pan-y"
            alt={productName ? `3D model of ${productName}` : '3D furniture model'}
            style={{ width: '100%', height: '100%' }}
          >
            <button slot="ar-button" className={styles.arButton}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              View in Your Space
            </button>
            <div slot="progress-bar" className={styles.progressBar}>
              <div className={styles.progressFill} />
            </div>
          {/* @ts-expect-error model-viewer closing tag */}
          </model-viewer>
        </div>

        <div className={styles.controls}>
          <div className={styles.hint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              <path d="M12 16v-4m0-4h.01" />
            </svg>
            <span>Drag to rotate. Pinch to zoom. {arSupported ? 'Tap the AR button to place in your room.' : ''}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
