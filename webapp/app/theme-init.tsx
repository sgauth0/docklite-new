'use client';

import { useEffect } from 'react';

export default function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem('docklite-theme');
    if (stored) {
      // Migrate old 'new' theme to 'unicorn'
      const themeToApply = stored === 'new' ? 'unicorn' : stored;
      if (stored === 'new') {
        localStorage.setItem('docklite-theme', 'unicorn');
      }
      document.documentElement.setAttribute('data-theme', themeToApply);
    }
  }, []);

  return null;
}
