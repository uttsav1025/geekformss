import { useCallback, useEffect, useState } from 'react';

const KEY = 'geekforms.theme';
export type Theme = 'system' | 'light' | 'dark';
export const THEMES: Theme[] = ['system', 'light', 'dark'];

const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** 'system' removes the attribute so the prefers-color-scheme media query decides. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Shared theme state; every toggle on the page stays in sync. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    const sync = () => setThemeState(readTheme());
    window.addEventListener('geekforms:theme', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('geekforms:theme', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: still apply for this page view */
    }
    applyTheme(next);
    setThemeState(next);
    window.dispatchEvent(new Event('geekforms:theme'));
  }, []);

  return [theme, setTheme];
}
