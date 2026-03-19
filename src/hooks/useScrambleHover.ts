'use client';

import { useEffect, useRef } from 'react';

const randomChar = () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];

export default function useScrambleHover<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = () => {
      let step = 0;
      const chars = text.split('');
      const interval = setInterval(() => {
        el.textContent = chars
          .map((c, i) => (i < step ? c : /[a-zA-Z0-9]/.test(c) ? randomChar() : c))
          .join('');
        step++;
        if (step > chars.length) {
          clearInterval(interval);
          el.textContent = text;
        }
      }, 38);
    };

    el.addEventListener('mouseenter', handler);
    return () => el.removeEventListener('mouseenter', handler);
  }, [text]);

  return ref;
}
