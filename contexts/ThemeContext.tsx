import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeColors {
  // Main backgrounds
  background: string;
  surface: string;
  surfaceLight: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Borders
  border: string;
  
  // Brand colors
  primary: string;
  secondary: string;
  accent: string;
  gold: string;
  
  // Status colors
  success: string;
  danger: string;
  warning: string;
  
  // Chart colors
  chartGreen: string;
  chartRed: string;
  
  // Special colors
  neonCyan: string;
  neonPurple: string;
  neonGreen: string;
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@wealtharena_theme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  // Load theme from storage on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const colors: ThemeColors = theme === 'dark' ? {
    // DARK MODE - Fingo Theme
    background: '#1A1F2E',
    surface: '#2C3547',
    surfaceLight: '#374151',
    
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    
    border: '#374151',
    
    primary: '#4A9DFF',
    secondary: '#7FD957',
    accent: '#7FD957',
    gold: '#FFD700',
    
    success: '#7FD957',
    danger: '#FF6B6B',
    warning: '#FF9500',
    
    chartGreen: '#7FD957',
    chartRed: '#FF6B6B',
    
    neonCyan: '#4A9DFF',
    neonPurple: '#C724F5',
    neonGreen: '#7FD957',
  } : {
    // LIGHT MODE - Fresh & Clean
    background: '#F5F8FA',
    surface: '#FFFFFF',
    surfaceLight: '#F7F9FB',
    
    text: '#1A1F2E',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    
    border: '#D1D5DB',
    
    primary: '#2874C8',
    secondary: '#4CAF50',
    accent: '#4CAF50',
    gold: '#F59E0B',
    
    success: '#4CAF50',
    danger: '#EF4444',
    warning: '#F59E0B',
    
    chartGreen: '#10B981',
    chartRed: '#EF4444',
    
    neonCyan: '#0EA5E9',
    neonPurple: '#A855F7',
    neonGreen: '#10B981',
  };

  const value = useMemo(() => ({ theme, toggleTheme, colors }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

