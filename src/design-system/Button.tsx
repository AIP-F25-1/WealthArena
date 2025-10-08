// Button Component - Accessible, consistent button with variants
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { tokens } from './tokens';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'medium',
  children,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  fullWidth = false,
}: ButtonProps) => {
  const { theme } = useTheme();

  const sizeStyles = {
    small: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
    medium: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 },
    large: { paddingVertical: 16, paddingHorizontal: 24, minHeight: 52 },
  };

  const variantStyles = {
    primary: {
      backgroundColor: theme.primary,
      borderWidth: 0,
    },
    secondary: {
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    danger: {
      backgroundColor: theme.danger,
      borderWidth: 0,
    },
  };

  const textColors = {
    primary: theme.bg,
    secondary: theme.primary,
    ghost: theme.text,
    danger: theme.bg,
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        {
          opacity: pressed ? 0.85 : isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator 
            size="small" 
            color={textColors[variant]} 
            style={styles.loader} 
          />
        )}
        {!loading && icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>{icon}</View>
        )}
        <Text 
          weight="semibold" 
          color={textColors[variant]}
          style={styles.text}
        >
          {children}
        </Text>
        {!loading && icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: tokens.spacing.sm,
  },
  iconRight: {
    marginLeft: tokens.spacing.sm,
  },
  loader: {
    marginRight: tokens.spacing.sm,
  },
});

