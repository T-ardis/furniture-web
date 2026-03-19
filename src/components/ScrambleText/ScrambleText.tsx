'use client';

import { useEffect, useRef } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

interface Props {
  text: string;
  className?: string;
  tag?: 'span' | 'p' | 'h2' | 'h3';
}

export default function ScrambleText({ text, className, tag: Tag = 'span' }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return <Tag ref={ref as React.RefObject<never>} className={className}>{text}</Tag>;
}
