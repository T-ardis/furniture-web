'use client';

import { useCallback, useRef, useState } from 'react';
import { findSimilarStream, type ResearchResultItem } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './SimilarItems.module.css';

interface Props {
  productImageBase64: string;
  productName: string;
  productCategory: string;
}

const RETAILER_COLORS: Record<string, string> = {
  Wayfair: '#7b2d8b',
  Ikea: '#0058a3',
  Amazon: '#ff9900',
  Westelm: '#2c2c2c',
  Cb2: '#1a1a1a',
  Ebay: '#e53238',
};

export default function SimilarItems({ productImageBase64, productName, productCategory }: Props) {
  const [results, setResults] = useState<ResearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [completedRetailers, setCompletedRetailers] = useState<string[]>([]);
  const { success, error: showError } = useToast();
  const abortRef = useRef<(() => void) | null>(null);

  const search = useCallback(() => {
    setIsSearching(true);
    setError(null);
    setResults([]);
    setHasSearched(false);
    setCompletedRetailers([]);

    // Abort any previous stream
    abortRef.current?.();

    abortRef.current = findSimilarStream(
      productImageBase64,
      productName,
      productCategory,
      // onBatch — append new items as each retailer completes
      (batch) => {
        setResults(prev => [...prev, ...batch]);
        // Track which retailers just completed
        const newRetailers = [...new Set(batch.map(item => item.retailer))];
        setCompletedRetailers(prev => [...prev, ...newRetailers]);
        success(`Found ${batch.length} items from ${newRetailers.join(', ')}`);
      },
      // onDone
      () => {
        setIsSearching(false);
        setHasSearched(true);
        abortRef.current = null;
      },
      // onError
      (msg) => {
        setError(msg);
        setIsSearching(false);
        setHasSearched(true);
        showError(msg);
        abortRef.current = null;
      },
    );
  }, [productImageBase64, productName, productCategory, success, showError]);

  const ALL_RETAILERS = ['Wayfair', 'IKEA', 'West Elm', 'CB2', 'Amazon', 'eBay'];

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Discover</span>
        <h2 className={styles.headline}>
          Find <em>similar</em> pieces.
        </h2>
        <p className={styles.sub}>
          We&apos;ll search IKEA, Wayfair, West Elm, CB2, Amazon, and eBay for furniture with a similar vibe.
        </p>

        {!hasSearched && !isSearching && results.length === 0 && (
          <button className={styles.searchBtn} onClick={search}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Find Similar Furniture
          </button>
        )}

        {isSearching && (
          <div className={styles.searching}>
            <div className={styles.spinner} />
            <div className={styles.searchingText}>
              <span className={styles.searchingLabel}>
                {results.length > 0
                  ? `Found ${results.length} items — waiting for more retailers...`
                  : 'Searching across retailers...'}
              </span>
              <span className={styles.searchingHint}>Each retailer takes 30-120 seconds. Results appear as they arrive.</span>
            </div>
            <div className={styles.retailers}>
              {ALL_RETAILERS.map(name => {
                const done = completedRetailers.some(
                  r => r.toLowerCase() === name.toLowerCase()
                );
                return (
                  <span
                    key={name}
                    className={`${styles.retailerPill} ${done ? styles.retailerDone : ''}`}
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.grid}>
            {results.map((item, i) => (
              <a
                key={`${item.url}-${i}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
              >
                {item.image_url ? (
                  <div className={styles.cardImage}>
                    <img src={item.image_url} alt={item.title} loading="lazy" />
                  </div>
                ) : (
                  <div className={`${styles.cardImage} ${styles.cardImagePlaceholder}`}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
                <div className={styles.cardBody}>
                  <span
                    className={styles.retailerBadge}
                    style={{ background: RETAILER_COLORS[item.retailer] || '#333' }}
                  >
                    {item.retailer}
                  </span>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  {item.price && <span className={styles.cardPrice}>{item.price}</span>}
                </div>
                <span className={styles.cardLink}>
                  View on {item.retailer}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </span>
              </a>
            ))}
          </div>
        )}

        {hasSearched && results.length === 0 && !isSearching && !error && (
          <div className={styles.empty}>
            <p>No similar items found. Try a different product image or category.</p>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={search}>Try Again</button>
          </div>
        )}
      </div>
    </section>
  );
}
