// FAB Component - Floating Action Button for AI Chat
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Platform, Animated } from 'react-native';
import { useTheme } from './ThemeProvider';
import { tokens } from './tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface FABProps {
  onPress?: () => void;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export const FAB = ({ 
  onPress, 
  icon,
  accessibilityLabel = 'Open AI Assistant'
}: FABProps) => {
  const { theme, mode } = useTheme();
  const bobAnimation = useRef(new Animated.Value(0)).current;

  // Subtle bob animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnimation, {
          toValue: -6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(bobAnimation, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bobAnimation]);

  const shadowStyle = Platform.select({
    ios: {
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: 12,
    },
    default: {},
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: bobAnimation }] }
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          { 
            backgroundColor: theme.primary,
            opacity: pressed ? 0.85 : 1,
          },
          shadowStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {icon || <MaterialCommunityIcons name="robot-outline" size={30} color="#FFFFFF" />}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: tokens.spacing.md,
    bottom: Platform.OS === 'android' ? 120 : 100,
    zIndex: 1000,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

