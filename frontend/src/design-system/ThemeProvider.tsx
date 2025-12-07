// WealthArena Theme Provider with Light/Dark Mode Support
import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme } from './tokens';

const THEME_STORAGE_KEY = '@wealtharena_theme_v2';

interface ThemeContextType {
  theme: Theme;
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = Appearance.getColorScheme() || 'light';
  const [mode, setModeState] = useState<'light' | 'dark'>(systemColorScheme === 'dark' ? 'dark' : 'light');

  // Load saved theme preference on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedMode === 'light' || savedMode === 'dark') {
        setModeState(savedMode);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const setMode = async (newMode: 'light' | 'dark') => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

