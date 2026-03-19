'use client';

import { useRef, useState } from 'react';
import { markWaitlisted, getUtmParams } from '@/lib/gate';
import styles from './WaitlistGate.module.css';

interface Props {
  onClose: () => void;
  onJoined: () => void;
}

export default function WaitlistGate({ onClose, onJoined }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inputRef.current?.value.trim();
    if (!email) return;

    setLoading(true);
    setError(false);

    try {
      const utm = getUtmParams();
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...utm }),
      });
      if (!res.ok) throw new Error();
      markWaitlisted();
      setDone(true);
      setTimeout(() => onJoined(), 2000);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {done ? (
          <div className={styles.successState}>
            <div className={styles.checkIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 16.5l4.5 4.5 7.5-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className={styles.successTitle}>You&apos;re on the list!</h3>
            <p className={styles.successSub}>Unlimited generations unlocked.</p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.limitIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className={styles.title}>You&apos;ve used your free generation</h3>
            </div>

            <p className={styles.description}>
              Join our waitlist to unlock <strong>unlimited generations</strong>, room previews, and similar item search.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="email"
                className={styles.input}
                placeholder="your@email.com"
                required
                autoFocus
                aria-label="Email address"
              />
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <>
                    <span className={styles.btnSpinner} />
                    Joining...
                  </>
                ) : (
                  'Join Waitlist'
                )}
              </button>
            </form>

            {error && (
              <p className={styles.errorNote}>Something went wrong. Please try again.</p>
            )}

            <p className={styles.note}>No spam. We&apos;ll notify you when early access opens.</p>
          </>
        )}
      </div>
    </div>
  );
}
