/**
 * Loading Spinner Component
 * Animated loading indicator with customizable variants
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Text, tokens } from '@/src/design-system';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  text?: string;
  variant?: 'spinner' | 'dots' | 'pulse';
}

export default function LoadingSpinner({
  size = 40,
  color = '#007AFF',
  text,
  variant = 'spinner',
}: LoadingSpinnerProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (variant === 'spinner') {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1
      );
    } else if (variant === 'dots') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    } else if (variant === 'pulse') {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    }
  }, [variant]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map((index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: size / 4,
                    height: size / 4,
                    backgroundColor: color,
                    borderRadius: size / 8,
                  },
                  useAnimatedStyle(() => ({
                    transform: [
                      { scale: index === 0 ? scale.value : 1 },
                    ],
                  })),
                ]}
              />
            ))}
          </View>
        );
      
      case 'pulse':
        return (
          <Animated.View
            style={[
              styles.pulse,
              {
                width: size,
                height: size,
                backgroundColor: color,
                borderRadius: size / 2,
              },
              spinnerStyle,
            ]}
          />
        );
      
      default:
        return (
          <Animated.View
            style={[
              styles.spinner,
              {
                width: size,
                height: size,
                borderWidth: size / 8,
                borderColor: color,
                borderTopColor: 'transparent',
                borderRadius: size / 2,
              },
              spinnerStyle,
            ]}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderSpinner()}
      {text && (
        <Text variant="small" style={[styles.text, { color }]}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  spinner: {
    borderStyle: 'solid',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    alignItems: 'center',
  },
  dot: {
    // Styling handled inline
  },
  pulse: {
    // Styling handled inline
  },
  text: {
    textAlign: 'center',
  },
});
