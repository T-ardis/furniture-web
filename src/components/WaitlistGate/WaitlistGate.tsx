'use client';

import { useRef, useState } from 'react';
import { checkEmailInWaitlist, storeEmail } from '@/lib/gate';
import styles from './WaitlistGate.module.css';

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL || 'https://www.tardis-ai.com';

interface Props {
  onAuthed: (email: string) => void;
}

export default function WaitlistGate({ onAuthed }: Props) {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inputRef.current?.value.trim();
    if (!email) return;

    setLoading(true);
    setNotFound(false);

    const found = await checkEmailInWaitlist(email);

    if (found) {
      storeEmail(email);
      onAuthed(email);
    } else {
      setNotFound(true);
    }

    setLoading(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.limitIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3 className={styles.title}>Enter your email to continue</h3>
        </div>

        <p className={styles.description}>
          Access is limited to <strong>waitlist members</strong>. Enter the email you signed up with.
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
                Checking...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        {notFound && (
          <div className={styles.notFoundBlock}>
            <p className={styles.errorNote}>
              This email isn&apos;t on the waitlist yet.
            </p>
            <a href={LANDING_URL + '#cta'} className={styles.landingLink}>
              Join the waitlist →
            </a>
          </div>
        )}

        <p className={styles.note}>
          Don&apos;t have access?{' '}
          <a href={LANDING_URL + '#cta'} className={styles.inlineLink}>Sign up on our landing page</a>
        </p>
      </div>
    </div>
  );
}
