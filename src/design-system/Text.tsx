// Text Component - Typography wrapper with theme support
import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme } from './ThemeProvider';
import { tokens } from './tokens';

export interface TextProps extends RNTextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'xs';
  weight?: 'regular' | 'semibold' | 'bold';
  color?: string;
  center?: boolean;
  muted?: boolean;
}

export const Text = ({ 
  variant = 'body', 
  weight = 'regular', 
  color, 
  center, 
  muted,
  style, 
  children,
  ...props 
}: TextProps) => {
  const { theme } = useTheme();
  
  const fontSizeMap = {
    h1: tokens.font.sizes.h1,
    h2: tokens.font.sizes.h2,
    h3: tokens.font.sizes.h3,
    body: tokens.font.sizes.body,
    small: tokens.font.sizes.small,
    xs: tokens.font.sizes.xs,
  };

  const fontWeightMap = {
    regular: tokens.font.weights.regular,
    semibold: tokens.font.weights.semibold,
    bold: tokens.font.weights.bold,
  };

  const textColor = color || (muted ? theme.muted : theme.text);

  return (
    <RNText
      style={[
        {
          fontSize: fontSizeMap[variant],
          fontWeight: fontWeightMap[weight],
          color: textColor,
          textAlign: center ? 'center' : 'left',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

