'use client';

import { useRef, useState } from 'react';
import { storeEmail, checkEmailInWaitlist, autoSignupEmail } from '@/lib/gate';
import styles from './EmailGate.module.css';

interface Props {
  onAuthed: (email: string) => void;
  onClose?: () => void;
  mode: 'inline' | 'modal';
}

export default function EmailGate({ onAuthed, onClose, mode }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inputRef.current?.value.trim();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const alreadyExists = await checkEmailInWaitlist(email);

      if (!alreadyExists) {
        const ok = await autoSignupEmail(email);
        if (!ok) {
          setError('Something went wrong. Please try again.');
          setLoading(false);
          return;
        }
      }

      storeEmail(email);
      onAuthed(email);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className={styles.card}>
      {mode === 'modal' && onClose && (
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <div className={styles.header}>
        <div className={styles.icon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h3 className={styles.title}>
          {mode === 'modal'
            ? 'Enter your email to generate'
            : 'Ready to try your own?'}
        </h3>
      </div>

      <p className={styles.description}>
        Enter your email to generate a 3D model of <strong>your</strong> furniture. One free generation included.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="email"
          className={styles.input}
          placeholder="your@email.com"
          required
          autoFocus={mode === 'modal'}
          aria-label="Email address"
        />
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? (
            <>
              <span className={styles.btnSpinner} />
              Setting up...
            </>
          ) : (
            'Generate My Model'
          )}
        </button>
      </form>

      {error && <p className={styles.errorNote}>{error}</p>}
      <p className={styles.note}>No spam. Unsubscribe anytime.</p>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className={styles.overlay}>
        {content}
      </div>
    );
  }

  return <div className={styles.inlineWrap}>{content}</div>;
}
