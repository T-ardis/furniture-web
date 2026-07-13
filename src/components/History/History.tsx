'use client';

import { useEffect, useState } from 'react';
import { getHistory, removeFromHistory, clearHistory, type HistoryItem } from '@/lib/history';
import styles from './History.module.css';

interface Props {
  onSelect: (item: HistoryItem) => void;
}

export default function History({ onSelect }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Read localStorage after mount: the server renders an empty list, then
    // the client hydrates it. Doing this in an effect (rather than during
    // render) is what keeps SSR/CSR markup identical and avoids a hydration
    // mismatch — the intentional, correct use of a post-mount state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getHistory());
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={styles.container}>
      <button className={styles.toggleBtn} onClick={() => setIsOpen(!isOpen)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Recent ({items.length})
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Recent Generations</span>
            <button
              className={styles.clearBtn}
              onClick={() => { clearHistory(); setItems([]); }}
            >
              Clear All
            </button>
          </div>

          <div className={styles.list}>
            {items.map(item => (
              <div
                key={item.id}
                className={styles.item}
                role="button"
                tabIndex={0}
                onClick={() => { onSelect(item); setIsOpen(false); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item); setIsOpen(false); } }}
              >
                <img src={item.imageDataUrl} alt={item.name} className={styles.itemImage} />
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemMeta}>
                    {item.category} &middot; {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={e => {
                    e.stopPropagation();
                    removeFromHistory(item.id);
                    setItems(getHistory());
                  }}
                  aria-label="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
