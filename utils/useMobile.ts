import { useState, useEffect } from 'react';

export const useMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return w < 768 && (touch || w < 640);
  });

  useEffect(() => {
    const checkMobile = () => {
      // Check if window width is less than 768px (md breakpoint) AND it's a touch device
      const widthMatch = window.innerWidth < 768;
      const touchMatch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      // On first render, default to width-based check if touch isn't available yet
      if (typeof window === 'undefined') return;
      setIsMobile(widthMatch && (touchMatch || window.innerWidth < 640));
    };

    // Initial check
    checkMobile();

    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return isMobile;
};
