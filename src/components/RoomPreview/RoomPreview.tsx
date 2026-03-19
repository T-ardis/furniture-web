'use client';

import { useRef, useState, type DragEvent } from 'react';
import { generateRoomPreview, imageToBase64 } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './RoomPreview.module.css';

interface Props {
  productImageBase64: string;
  productName: string;
}

export default function RoomPreview({ productImageBase64, productName }: Props) {
  const [roomFile, setRoomFile] = useState<File | null>(null);
  const [roomPreviewUrl, setRoomPreviewUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { success, error: showError } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setRoomFile(file);
    setRoomPreviewUrl(URL.createObjectURL(file));
    setResultImage(null);
    setError(null);

    // Auto-generate preview
    setIsGenerating(true);
    try {
      const roomB64 = await imageToBase64(file, 1024);
      const res = await generateRoomPreview(roomB64, productImageBase64, productName);
      setResultImage(`data:image/jpeg;base64,${res.preview_image}`);
      success('Room preview generated!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Preview generation failed';
      setError(msg);
      showError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Room Preview</span>
        <h2 className={styles.headline}>
          See it in <em>your room.</em>
        </h2>
        <p className={styles.sub}>
          Upload a photo of your room and our AI will place the furniture inside it — photorealistically.
        </p>

        {!resultImage && (
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''} ${roomPreviewUrl ? styles.dropZoneHasImage : ''}`}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileRef.current?.click()}
          >
            {isGenerating && roomPreviewUrl ? (
              <div className={styles.generating}>
                <img src={roomPreviewUrl} alt="Your room" className={styles.roomThumb} />
                <div className={styles.generatingOverlay}>
                  <div className={styles.spinner} />
                  <span>AI is placing your furniture...</span>
                </div>
              </div>
            ) : roomPreviewUrl ? (
              <img src={roomPreviewUrl} alt="Your room" className={styles.roomThumb} />
            ) : (
              <div className={styles.dropContent}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.dropIcon}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className={styles.dropLabel}>Drop a room photo or click to upload</span>
                <span className={styles.dropHint}>Take a photo of your room with your phone camera for best results</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className={styles.fileInput}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {resultImage && (
          <div className={styles.resultWrap}>
            <div className={styles.comparisonContainer}>
              {showComparison && roomPreviewUrl ? (
                <div className={styles.sideBySide}>
                  <div className={styles.compareHalf}>
                    <span className={styles.compareLabel}>Before</span>
                    <img src={roomPreviewUrl} alt="Room before" />
                  </div>
                  <div className={styles.compareHalf}>
                    <span className={styles.compareLabel}>After</span>
                    <img src={resultImage} alt="Room with furniture" />
                  </div>
                </div>
              ) : (
                <img src={resultImage} alt="Room with furniture placed" className={styles.resultImage} />
              )}
            </div>

            <div className={styles.resultActions}>
              <button
                className={styles.compareBtn}
                onClick={() => setShowComparison(!showComparison)}
              >
                {showComparison ? 'Full Preview' : 'Compare Before/After'}
              </button>
              <button
                className={styles.retryBtn}
                onClick={() => {
                  setResultImage(null);
                  setRoomFile(null);
                  setRoomPreviewUrl(null);
                }}
              >
                Try Another Room
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => { setError(null); setRoomFile(null); setRoomPreviewUrl(null); }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
