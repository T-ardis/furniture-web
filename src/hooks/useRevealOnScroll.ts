'use client';

import { useEffect, useRef } from 'react';

type Options = {
  y?: number;
  duration?: number;
  delay?: number;
  threshold?: number;
  stagger?: number;
};

export default function useRevealOnScroll<T extends HTMLElement>({
  y = 40,
  duration = 0.65,
  delay = 0,
  threshold = 0.15,
  stagger = 0,
}: Options = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const init = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const targets = stagger > 0 ? Array.from(el.children) as HTMLElement[] : [el];

      gsap.fromTo(
        targets,
        { y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration,
          ease: 'power2.out',
          delay,
          stagger: stagger > 0 ? stagger : 0,
          scrollTrigger: {
            trigger: el,
            start: `top ${Math.round((1 - threshold) * 100)}%`,
            toggleActions: 'play none none none',
          },
        },
      );
    };

    init();
  }, [y, duration, delay, threshold, stagger]);

  return ref;
}
