/**
 * WealthArena Theme Configuration
 * Black/neon-green terminal theme for mobile components
 */

export interface WealthArenaTheme {
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
    border: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    fontFamily: string;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
}

export const defaultTheme: WealthArenaTheme = {
  colors: {
    background: '#0b0f12',
    surface: '#1a1f24',
    primary: '#00ff88',
    secondary: '#00cc6a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    success: '#00ff88',
    warning: '#ffaa00',
    error: '#ff4444',
    border: '#333333',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
    },
    fontFamily: 'Courier New, monospace',
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
};

