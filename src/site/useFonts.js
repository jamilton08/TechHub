import { useEffect } from 'react';

export function useFonts() {
  useEffect(() => {
    if (document.getElementById('site-fonts')) return;
    const link = document.createElement('link');
    link.id = 'site-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}
