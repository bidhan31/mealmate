import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ColorTheme = 'emerald' | 'indigo' | 'violet' | 'monochrome';
export type FontTheme = 'inter' | 'outfit' | 'roboto';

interface ThemeProviderState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colorTheme: ColorTheme;
  setColorTheme: (colorTheme: ColorTheme) => void;
  font: FontTheme;
  setFont: (font: FontTheme) => void;
}

const initialState: ThemeProviderState = {
  mode: 'system',
  setMode: () => null,
  colorTheme: 'emerald',
  setColorTheme: () => null,
  font: 'inter',
  setFont: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultMode = 'system',
  defaultColorTheme = 'emerald',
  defaultFont = 'inter',
}: {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  defaultColorTheme?: ColorTheme;
  defaultFont?: FontTheme;
}) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('mm-ui-mode') as ThemeMode) || defaultMode
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    () => (localStorage.getItem('mm-ui-color') as ColorTheme) || defaultColorTheme
  );
  const [font, setFont] = useState<FontTheme>(
    () => (localStorage.getItem('mm-ui-font') as FontTheme) || defaultFont
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // Apply Mode (Light/Dark)
    root.classList.remove('light', 'dark');
    if (mode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(mode);
    }

    // Apply Color Theme
    if (colorTheme === 'emerald') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', colorTheme);
    }

    // Apply Font
    root.setAttribute('data-font', font);
  }, [mode, colorTheme, font]);

  const value = {
    mode,
    setMode: (m: ThemeMode) => {
      localStorage.setItem('mm-ui-mode', m);
      setMode(m);
    },
    colorTheme,
    setColorTheme: (c: ColorTheme) => {
      localStorage.setItem('mm-ui-color', c);
      setColorTheme(c);
    },
    font,
    setFont: (f: FontTheme) => {
      localStorage.setItem('mm-ui-font', f);
      setFont(f);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
