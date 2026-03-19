'use client';

import { useRef, useState, type DragEvent } from 'react';
import styles from './UrlInput.module.css';

export interface ProductInput {
  name: string;
  category: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  imageFile: File | null;
  imagePreviewUrl: string;
  description?: string;
  price?: string;
  allImageUrls?: string[];
}

const CATEGORIES = [
  'sofa', 'chair', 'table', 'desk', 'shelf', 'bed',
  'lamp', 'cabinet', 'dresser', 'rug', 'storage', 'other',
];

type Tab = 'url' | 'upload';

interface Props {
  onSubmit: (input: ProductInput) => void;
  disabled?: boolean;
}

export default function UrlInput({ onSubmit, disabled }: Props) {
  const [tab, setTab] = useState<Tab>('url');

  // Shared state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [widthCm, setWidthCm] = useState(80);
  const [heightCm, setHeightCm] = useState(80);
  const [depthCm, setDepthCm] = useState(50);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  // URL tab state
  const [urlValue, setUrlValue] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Upload tab state
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Fetch an external image through our proxy to avoid CORS */
  const fetchImageViaProxy = async (url: string): Promise<{ file: File; previewUrl: string }> => {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const imgRes = await fetch(proxyUrl);
    if (!imgRes.ok) throw new Error('Image proxy failed');
    const blob = await imgRes.blob();
    const file = new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' });
    return { file, previewUrl: URL.createObjectURL(blob) };
  };

  // ── URL scraping ──────────────────────────────────────────────────────────

  const handleScrape = async () => {
    if (!urlValue.trim()) return;
    setIsScraping(true);
    setScrapeError(null);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlValue.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Scraping failed' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Apply scraped data
      if (data.title) setName(data.title);
      if (data.category && CATEGORIES.includes(data.category)) setCategory(data.category);
      if (data.widthCm) setWidthCm(Math.round(data.widthCm));
      if (data.heightCm) setHeightCm(Math.round(data.heightCm));
      if (data.depthCm) setDepthCm(Math.round(data.depthCm));
      if (data.description) setDescription(data.description);
      if (data.price) setPrice(data.price);

      // Handle images — fetch through proxy to avoid CORS
      if (data.imageUrls?.length > 0) {
        setAllImageUrls(data.imageUrls);
        setSelectedImageIdx(0);
        try {
          const { file, previewUrl } = await fetchImageViaProxy(data.imageUrls[0]);
          setImageFile(file);
          setImagePreview(previewUrl);
        } catch {
          // Fallback: use proxied URL as preview src
          setImagePreview(`/api/image-proxy?url=${encodeURIComponent(data.imageUrls[0])}`);
        }
      }

      setHasFetched(true);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scraping failed');
    } finally {
      setIsScraping(false);
    }
  };

  const selectImage = async (idx: number) => {
    if (idx === selectedImageIdx || !allImageUrls[idx]) return;
    setSelectedImageIdx(idx);

    try {
      const { file, previewUrl } = await fetchImageViaProxy(allImageUrls[idx]);
      setImageFile(file);
      setImagePreview(previewUrl);
    } catch {
      setImagePreview(`/api/image-proxy?url=${encodeURIComponent(allImageUrls[idx])}`);
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAllImageUrls([]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const canSubmit = imagePreview && name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      category,
      widthCm,
      heightCm,
      depthCm,
      imageFile,
      imagePreviewUrl: imagePreview!,
      description: description || undefined,
      price: price || undefined,
      allImageUrls: allImageUrls.length > 0 ? allImageUrls : undefined,
    });
  };

  // ── Reset on tab switch ───────────────────────────────────────────────────

  const switchTab = (newTab: Tab) => {
    if (newTab === tab) return;
    setTab(newTab);
    // Reset state
    setName('');
    setCategory('other');
    setWidthCm(80);
    setHeightCm(80);
    setDepthCm(50);
    setDescription('');
    setPrice('');
    setImageFile(null);
    setImagePreview(null);
    setAllImageUrls([]);
    setSelectedImageIdx(0);
    setUrlValue('');
    setScrapeError(null);
    setHasFetched(false);
  };

  return (
    <section id="input" className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Get Started</span>
        <h1 className={styles.headline}>
          See your furniture<br /><em>in your space.</em>
        </h1>
        <p className={styles.sub}>
          Paste a product link to auto-extract everything, or upload a photo manually.
        </p>

        {/* Tab Switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'url' ? styles.tabActive : ''}`}
            onClick={() => switchTab('url')}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            From URL
          </button>
          <button
            className={`${styles.tab} ${tab === 'upload' ? styles.tabActive : ''}`}
            onClick={() => switchTab('upload')}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Image
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>

          {/* ── URL Tab ── */}
          {tab === 'url' && (
            <>
              <div className={styles.urlRow}>
                <input
                  type="url"
                  className={styles.urlInput}
                  placeholder="https://www.ikea.com/us/en/p/kallax-shelf-unit..."
                  value={urlValue}
                  onChange={e => setUrlValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScrape(); } }}
                  disabled={isScraping}
                />
                <button
                  type="button"
                  className={styles.fetchBtn}
                  onClick={handleScrape}
                  disabled={isScraping || !urlValue.trim()}
                >
                  {isScraping ? (
                    <>
                      <span className={styles.btnSpinner} />
                      Extracting...
                    </>
                  ) : (
                    'Extract'
                  )}
                </button>
              </div>

              {scrapeError && (
                <div className={styles.scrapeError}>
                  <span className={styles.errorIcon}>!</span>
                  {scrapeError}
                </div>
              )}

              {isScraping && (
                <div className={styles.scrapingState}>
                  <div className={styles.scrapingBar}>
                    <div className={styles.scrapingFill} />
                  </div>
                  <span className={styles.scrapingHint}>
                    Fetching page, extracting product data, analyzing dimensions...
                  </span>
                </div>
              )}

              {/* Image gallery from scraped URLs */}
              {allImageUrls.length > 1 && (
                <div className={styles.imageGallery}>
                  <label className={styles.label}>Product Images — select the best one</label>
                  <div className={styles.galleryGrid}>
                    {allImageUrls.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        className={`${styles.galleryThumb} ${idx === selectedImageIdx ? styles.galleryThumbActive : ''}`}
                        onClick={() => selectImage(idx)}
                      >
                        <img src={`/api/image-proxy?url=${encodeURIComponent(url)}`} alt={`Product image ${idx + 1}`} loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main preview image */}
              {imagePreview && (
                <div className={styles.mainPreview}>
                  <img src={imagePreview} alt="Selected product" className={styles.preview} />
                </div>
              )}
            </>
          )}

          {/* ── Upload Tab ── */}
          {tab === 'upload' && (
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''} ${imagePreview ? styles.dropZoneHasImage : ''}`}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Product preview" className={styles.preview} />
              ) : (
                <div className={styles.dropContent}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.dropIcon}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className={styles.dropLabel}>Drop a product photo or click to upload</span>
                  <span className={styles.dropHint}>JPEG, PNG — best with a clean background</span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* ── Extracted / editable fields (both tabs) ── */}
          {(hasFetched || tab === 'upload') && (
            <div className={styles.fields}>
              <div className={styles.fieldFull}>
                <label className={styles.label}>Product Name</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. KALLAX Shelf Unit"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              {price && (
                <div className={styles.field}>
                  <label className={styles.label}>Price</label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.priceInput}`}
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    readOnly={tab === 'url'}
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Category</label>
                <select
                  className={styles.select}
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Width (cm)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={widthCm}
                  onChange={e => setWidthCm(Number(e.target.value))}
                  min={1} max={500}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Height (cm)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={heightCm}
                  onChange={e => setHeightCm(Number(e.target.value))}
                  min={1} max={500}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Depth (cm)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={depthCm}
                  onChange={e => setDepthCm(Number(e.target.value))}
                  min={1} max={500}
                />
              </div>

              {description && (
                <div className={styles.fieldFull}>
                  <label className={styles.label}>Description</label>
                  <p className={styles.descriptionText}>{description}</p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={disabled || !canSubmit}
          >
            Generate 3D Model
          </button>
        </form>
      </div>
    </section>
  );
}
