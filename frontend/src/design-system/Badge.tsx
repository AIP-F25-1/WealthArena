// Badge Component - Small label for status/count
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { tokens } from './tokens';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'accent' | 'default';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export const Badge = ({ 
  children, 
  variant = 'primary',
  size = 'small',
  style,
}: BadgeProps) => {
  const { theme } = useTheme();

  const variantColors = {
    primary: theme.primary,
    secondary: theme.accent,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    accent: theme.accent,
    default: theme.textMuted,
  };

  const sizeStyles = {
    small: { paddingVertical: 4, paddingHorizontal: 8 },
    medium: { paddingVertical: 6, paddingHorizontal: 12 },
    large: { paddingVertical: 8, paddingHorizontal: 16 },
  };

  const textVariant = size === 'small' ? 'xs' : size === 'medium' ? 'small' : 'body';

  return (
    <View
      style={[
        styles.badge,
        sizeStyles[size],
        { backgroundColor: variantColors[variant] },
        style,
      ]}
    >
      <Text 
        variant={textVariant} 
        weight="semibold" 
        color="#FFFFFF"
      >
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: tokens.radius.pill,
    alignSelf: 'flex-start',
  },
});

