'use client';

import { useEffect } from 'react';

export default function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem('docklite-theme');
    if (stored) {
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  return null;
}
