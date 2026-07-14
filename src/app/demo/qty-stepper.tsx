'use client';

import { useState } from 'react';
import styles from './demo.module.css';

/**
 * Small, self-contained quantity stepper for the demo storefront.
 * Isolated as a client component so the surrounding PDP — including the
 * embed triggers and the loader <Script> — stays server-rendered.
 */
export function QtyStepper({ label = 'Quantity' }: { label?: string }) {
  const [qty, setQty] = useState(1);
  return (
    <div className={styles.qty} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.qtyBtn}
        aria-label="Decrease quantity"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
      >
        &minus;
      </button>
      <span className={styles.qtyVal} aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className={styles.qtyBtn}
        aria-label="Increase quantity"
        onClick={() => setQty((q) => Math.min(9, q + 1))}
      >
        +
      </button>
    </div>
  );
}
