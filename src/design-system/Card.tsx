// Card Component - Surface container with elevation
import React from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';
import { useTheme } from './ThemeProvider';
import { tokens } from './tokens';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof tokens.spacing;
  elevation?: 'low' | 'med' | 'high';
  noBorder?: boolean;
}

export const Card = ({ 
  children, 
  style, 
  padding = 'md',
  elevation = 'low',
  noBorder = false,
}: CardProps) => {
  const { theme } = useTheme();

  const paddingValue = tokens.spacing[padding];
  const elevationValue = tokens.elevation[elevation];

  const shadowStyle = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevationValue / 2 },
      shadowOpacity: 0.1,
      shadowRadius: elevationValue,
    },
    android: {
      elevation: elevationValue,
    },
    default: {},
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          padding: paddingValue,
          borderColor: noBorder ? 'transparent' : theme.border,
          borderWidth: noBorder ? 0 : 1,
        },
        shadowStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.md,
  },
});

