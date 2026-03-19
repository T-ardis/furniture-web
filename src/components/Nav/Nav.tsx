'use client';

import { useEffect, useRef, useState } from 'react';
import useScrambleHover from '@/hooks/useScrambleHover';
import styles from './Nav.module.css';

export default function Nav() {
  const logoRef = useScrambleHover<HTMLSpanElement>('TARDIS');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setIsHidden(y > lastScrollY.current && y > 100);
      setIsScrolled(y > 80);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={[
        styles.nav,
        isScrolled ? styles.scrolled : '',
        isHidden ? styles.hidden : '',
      ].join(' ')}
    >
      <a href="/" className={styles.logoLink}>
        <span ref={logoRef} className={styles.logo}>TARDIS</span>
        <span className={styles.logoSub}>furniture</span>
      </a>

      <div className={styles.right}>
        <a href="#input" className={styles.ctaBtn}>
          Try Now
        </a>
      </div>
    </nav>
  );
}
