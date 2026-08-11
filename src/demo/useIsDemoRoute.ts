import { useState, useEffect } from 'react';

export function isDemoPathname(pathname: string = window.location.pathname): boolean {
  return pathname.startsWith('/demo');
}

export function useIsDemoRoute(): boolean {
  const [isDemo, setIsDemo] = useState(() => isDemoPathname());

  useEffect(() => {
    const checkRoute = () => {
      setIsDemo(isDemoPathname());
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  return isDemo;
}
