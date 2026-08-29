import { useEffect, useRef } from 'react';

/**
 * Marks an element revealed the first time it enters the viewport.
 *
 * The signature motif is a rule that fills as it appears, reused wherever the
 * product shows progression rather than reinvented per surface. Reduced motion
 * and browsers without IntersectionObserver get the finished state immediately,
 * so the information is never carried by the animation alone.
 */
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reveal = () => element.setAttribute('data-revealed', 'true');

    // matchMedia and IntersectionObserver are both absent in some runtimes,
    // including jsdom; the finished state is the safe fallback either way.
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof IntersectionObserver !== 'function') {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal();
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}
