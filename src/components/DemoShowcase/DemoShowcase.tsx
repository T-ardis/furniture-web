'use client';

import ModelViewer from '@/components/ModelViewer/ModelViewer';
import ProductCard from '@/components/ProductCard/ProductCard';
import { DEMO_PRODUCT } from '@/lib/demo';
import styles from './DemoShowcase.module.css';

interface Props {
  onTryOwn: () => void;
}

export default function DemoShowcase({ onTryOwn }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Live Demo</span>
        <h2 className={styles.headline}>
          See it <em>in action.</em>
        </h2>
        <p className={styles.sub}>
          This is a real AI-generated 3D model. Drag to rotate, pinch to zoom,
          or tap the AR button to place it in your room.
        </p>
      </div>

      <ProductCard
        name={DEMO_PRODUCT.name}
        category={DEMO_PRODUCT.category}
        widthCm={DEMO_PRODUCT.widthCm}
        heightCm={DEMO_PRODUCT.heightCm}
        depthCm={DEMO_PRODUCT.depthCm}
        imagePreviewUrl={DEMO_PRODUCT.posterUrl}
      />

      <ModelViewer
        src={DEMO_PRODUCT.glbUrl}
        iosSrc={DEMO_PRODUCT.usdzUrl}
        poster={DEMO_PRODUCT.posterUrl}
        productName={DEMO_PRODUCT.name}
        eyebrow="Live Demo"
        headline="Interact with this model."
      />

      <div className={styles.demoBadge}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span>Sample model — generate your own below</span>
      </div>

      <div className={styles.ctaBlock}>
        <h3 className={styles.ctaTitle}>Like what you see?</h3>
        <p className={styles.ctaSub}>
          Generate a 3D model of <em>your</em> furniture. Free, takes 2 minutes.
        </p>
        <button className={styles.ctaBtn} onClick={onTryOwn}>
          Try With Your Own Furniture
        </button>
      </div>
    </div>
  );
}
