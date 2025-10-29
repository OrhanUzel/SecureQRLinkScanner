import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext({ theme: 'system', setTheme: () => {}, dark: false });

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();
  const [theme, setThemeState] = useState('system');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('theme');
        if (saved) setThemeState(saved);
      } catch {}
    })();
  }, []);

  const setTheme = async (th) => {
    try {
      setThemeState(th);
      await AsyncStorage.setItem('theme', th);
    } catch {}
  };

  const dark = theme === 'dark' || (theme === 'system' && scheme === 'dark');

  const value = useMemo(() => ({ theme, setTheme, dark }), [theme, dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}