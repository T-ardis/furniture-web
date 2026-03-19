'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from '@/components/Nav/Nav';
import UrlInput, { type ProductInput } from '@/components/UrlInput/UrlInput';
import ProductCard from '@/components/ProductCard/ProductCard';
import GenerationStatus from '@/components/GenerationStatus/GenerationStatus';
import ModelViewer from '@/components/ModelViewer/ModelViewer';
import RoomPreview from '@/components/RoomPreview/RoomPreview';
import SimilarItems from '@/components/SimilarItems/SimilarItems';
import History from '@/components/History/History';
import ShareModal from '@/components/ShareModal/ShareModal';
import WaitlistGate from '@/components/WaitlistGate/WaitlistGate';
import Footer from '@/components/Footer/Footer';
import { useToast } from '@/components/Toast/ToastProvider';
import useGeneration from '@/hooks/useGeneration';
import { imageToBase64, urlToBase64 } from '@/lib/api';
import { addToHistory, type HistoryItem } from '@/lib/history';
import { getStoredEmail, storeEmail, checkEmailInWaitlist, canGenerate, incrementGenerationCount, captureUtmParams } from '@/lib/gate';
import styles from './page.module.css';

export default function Home() {
  const gen = useGeneration();
  const { success, error: showError, info } = useToast();

  // Capture UTM params from URL on first load
  useEffect(() => { captureUtmParams(); }, []);

  // Auth state — email from localStorage or URL param
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const stored = getStoredEmail();
    if (stored) {
      setAuthedEmail(stored);
      setAuthChecked(true);
      return;
    }

    // Check URL param (redirect from landing after waitlist signup)
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      // Verify it's actually in the waitlist, then auto-auth
      checkEmailInWaitlist(emailParam).then((found) => {
        if (found) {
          storeEmail(emailParam);
          setAuthedEmail(emailParam);
          // Clean up URL
          const url = new URL(window.location.href);
          url.searchParams.delete('email');
          window.history.replaceState({}, '', url.pathname);
        }
        setAuthChecked(true);
      });
    } else {
      setAuthChecked(true);
    }
  }, []);

  const [product, setProduct] = useState<ProductInput | null>(null);
  const [productBase64, setProductBase64] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  // Refs for smooth scrolling to sections
  const productRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (input: ProductInput) => {
    if (!authedEmail) return;

    // Check generation limit on backend
    const allowed = await canGenerate(authedEmail);
    if (!allowed) {
      setLimitReached(true);
      return;
    }

    setProduct(input);
    gen.reset();

    setTimeout(() => {
      productRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      let b64: string;
      if (input.imageFile) {
        b64 = await imageToBase64(input.imageFile, 512);
      } else {
        b64 = await urlToBase64(input.imagePreviewUrl, 512);
      }
      setProductBase64(b64);
      info('Starting 3D generation...');
      gen.generate(b64);
    } catch {
      showError('Failed to process image. Please try again.');
    }
  }, [authedEmail, gen, info, showError]);

  const handleHistorySelect = useCallback(async (item: HistoryItem) => {
    const input: ProductInput = {
      name: item.name,
      category: item.category,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      depthCm: item.depthCm,
      imageFile: new File([], 'history'),
      imagePreviewUrl: item.imageDataUrl,
    };
    setProduct(input);
    setProductBase64(item.imageDataUrl.split(',')[1] || '');
    gen.reset();

    setTimeout(() => {
      productRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [gen]);

  // Save to history when model is ready
  if (gen.phase === 'ready' && gen.taskId && product && productBase64) {
    const historyItem: HistoryItem = {
      id: gen.taskId,
      name: product.name,
      category: product.category,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      depthCm: product.depthCm,
      imageDataUrl: product.imagePreviewUrl,
      taskId: gen.taskId,
      createdAt: new Date().toISOString(),
    };
    addToHistory(historyItem);
  }

  // Toast + scroll on phase transitions
  const prevPhaseRef = useRef(gen.phase);
  useEffect(() => {
    if (prevPhaseRef.current === gen.phase) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = gen.phase;

    if (gen.phase === 'ready' && prev !== 'ready') {
      if (authedEmail) incrementGenerationCount(authedEmail);
      success('3D model ready! Drag to rotate, pinch to zoom.');
      setTimeout(() => {
        modelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
    if (gen.phase === 'failed' && prev !== 'failed') {
      showError(gen.error || 'Generation failed. Please try again.');
    }
  }, [gen.phase, gen.error, success, showError, authedEmail]);

  const isGenerating = gen.phase !== 'idle' && gen.phase !== 'ready' && gen.phase !== 'failed';

  // Show nothing until we check localStorage
  if (!authChecked) return null;

  // Not authenticated — show email gate
  if (!authedEmail) {
    return (
      <>
        <Nav />
        <WaitlistGate onAuthed={(email) => setAuthedEmail(email)} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main>
        {/* Hero + Input */}
        <UrlInput onSubmit={handleSubmit} disabled={isGenerating} />

        {/* History */}
        {!product && (
          <div className={styles.historyWrap}>
            <History onSelect={handleHistorySelect} />
          </div>
        )}

        {/* Product Card */}
        {product && (
          <div ref={productRef}>
            <ProductCard
              name={product.name}
              category={product.category}
              widthCm={product.widthCm}
              heightCm={product.heightCm}
              depthCm={product.depthCm}
              imagePreviewUrl={product.imagePreviewUrl}
            />
          </div>
        )}

        {/* Generation Status */}
        {product && gen.phase !== 'idle' && gen.phase !== 'ready' && (
          <div className={styles.statusWrap}>
            <div className={styles.statusInner}>
              <GenerationStatus
                phase={gen.phase}
                progress={gen.progress}
                error={gen.error}
                onRetry={productBase64 ? () => gen.generate(productBase64) : undefined}
              />
            </div>
          </div>
        )}

        {/* 3D Model Viewer + AR */}
        {gen.phase === 'ready' && gen.modelBlobUrl && (
          <div ref={modelRef}>
            <ModelViewer
              src={gen.modelBlobUrl}
              iosSrc={gen.usdzUrl || undefined}
              poster={product?.imagePreviewUrl}
              productName={product?.name}
            />

            {/* Share button */}
            <div className={styles.shareWrap}>
              <div className={styles.shareInner}>
                <button className={styles.shareBtn} onClick={() => setShowShare(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share This Model
                </button>
                {limitReached ? (
                  <p className={styles.limitNote}>You&apos;ve used your free generation.</p>
                ) : (
                  <button
                    className={styles.newBtn}
                    onClick={async () => {
                      const allowed = await canGenerate(authedEmail);
                      if (!allowed) {
                        setLimitReached(true);
                        return;
                      }
                      setProduct(null); setProductBase64(null); gen.reset(); window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Generate Another
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Room Preview */}
        {product && productBase64 && (gen.phase === 'generating' || gen.phase === 'ready') && (
          <RoomPreview
            productImageBase64={productBase64}
            productName={product.name}
          />
        )}

        {/* Similar Items */}
        {product && productBase64 && (gen.phase === 'generating' || gen.phase === 'downloading' || gen.phase === 'ready') && (
          <SimilarItems
            productImageBase64={productBase64}
            productName={product.name}
            productCategory={product.category}
          />
        )}
      </main>
      <Footer />

      {/* Share Modal */}
      {showShare && gen.taskId && product && (
        <ShareModal
          taskId={gen.taskId}
          productName={product.name}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
