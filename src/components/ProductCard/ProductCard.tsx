'use client';

import styles from './ProductCard.module.css';

interface Props {
  name: string;
  category: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  imagePreviewUrl: string;
}

export default function ProductCard({ name, category, widthCm, heightCm, depthCm, imagePreviewUrl }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Your Product</span>

        <div className={styles.card}>
          <div className={styles.imageWrap}>
            <img src={imagePreviewUrl} alt={name} className={styles.image} />
          </div>

          <div className={styles.info}>
            <h2 className={styles.name}>{name}</h2>
            <span className={styles.category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>

            <div className={styles.dims}>
              <div className={styles.dim}>
                <span className={styles.dimLabel}>Width</span>
                <span className={styles.dimValue}>{widthCm}<small>cm</small></span>
              </div>
              <div className={styles.dimDivider} />
              <div className={styles.dim}>
                <span className={styles.dimLabel}>Height</span>
                <span className={styles.dimValue}>{heightCm}<small>cm</small></span>
              </div>
              <div className={styles.dimDivider} />
              <div className={styles.dim}>
                <span className={styles.dimLabel}>Depth</span>
                <span className={styles.dimValue}>{depthCm}<small>cm</small></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
