'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function smoothScrollToSection(sectionId: string, offset = 96): void {
  const element = document.getElementById(sectionId);
  if (!element) return;

  const start = window.scrollY;
  const target = element.getBoundingClientRect().top + start - offset;
  const distance = target - start;
  const duration = 650;
  let startTime: number | null = null;

  const step = (currentTime: number) => {
    if (startTime === null) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

export function useReportSectionNav(
  sectionIds: string[],
  watchKey?: string,
  defaultSection = 'overview'
) {
  const [activeSection, setActiveSection] = useState(defaultSection);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    smoothScrollToSection(sectionId);

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${sectionId}`);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 700);
  }, []);

  useEffect(() => {
    setActiveSection(defaultSection);
  }, [defaultSection, sectionIds.join('|')]);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const observedElements: Element[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: '-12% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5, 0.75],
      }
    );

    const observeSections = () => {
      sectionIds.forEach((sectionId) => {
        const element = document.getElementById(sectionId);
        if (element && !observedElements.includes(element)) {
          observer.observe(element);
          observedElements.push(element);
        }
      });
    };

    observeSections();
    const retryTimer = window.setTimeout(observeSections, 400);

    return () => {
      window.clearTimeout(retryTimer);
      observer.disconnect();
    };
  }, [sectionIds, watchKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace('#', '');
    if (!hash || !sectionIds.includes(hash)) return;

    const scrollTimer = window.setTimeout(() => scrollToSection(hash), 300);
    return () => window.clearTimeout(scrollTimer);
  }, [sectionIds, watchKey, scrollToSection]);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    },
    []
  );

  return { activeSection, scrollToSection };
}
