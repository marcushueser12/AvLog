import { useState, useEffect, useRef } from 'react';

const THROTTLE_MS = 150;

export const useMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return w < 768 && (touch || w < 640);
  });

  const lastCallRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return;
      const widthMatch = window.innerWidth < 768;
      const touchMatch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(widthMatch && (touchMatch || window.innerWidth < 640));
    };

    const throttledCheck = () => {
      const now = Date.now();
      const elapsed = now - lastCallRef.current;
      if (elapsed >= THROTTLE_MS) {
        lastCallRef.current = now;
        checkMobile();
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          lastCallRef.current = Date.now();
          checkMobile();
        }, THROTTLE_MS - elapsed);
      }
    };

    // Initial check
    checkMobile();

    window.addEventListener('resize', throttledCheck);
    window.addEventListener('orientationchange', checkMobile); // orientationchange fires less often, no throttle
    return () => {
      window.removeEventListener('resize', throttledCheck);
      window.removeEventListener('orientationchange', checkMobile);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return isMobile;
};
