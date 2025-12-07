/**
 * Reward Toast Component
 * Animated toast notifications for XP/coins rewards
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Text, Icon, tokens } from '@/src/design-system';

const { height } = Dimensions.get('window');

interface RewardToastProps {
  type: 'xp' | 'coins' | 'achievement';
  amount: number;
  reason: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export default function RewardToast({
  type,
  amount,
  reason,
  visible,
  onHide,
  duration = 3000,
}: RewardToastProps) {
  const translateY = useSharedValue(height);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      // Show animation
      translateY.value = withSequence(
        withTiming(0, { duration: 500, easing: Easing.out(Easing.back(1.2)) }),
        withDelay(duration, withTiming(height, { duration: 300, easing: Easing.in(Easing.ease) }))
      );
      
      opacity.value = withSequence(
        withTiming(1, { duration: 500 }),
        withDelay(duration, withTiming(0, { duration: 300 }))
      );
      
      scale.value = withSequence(
        withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.2)) }),
        withDelay(duration, withTiming(0.8, { duration: 300 }))
      );

      // Auto-hide after duration
      setTimeout(() => {
        runOnJS(onHide)();
      }, duration + 800);
    }
  }, [visible, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const getIconName = () => {
    switch (type) {
      case 'xp':
        return 'star';
      case 'coins':
        return 'coin';
      case 'achievement':
        return 'trophy';
      default:
        return 'star';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'xp':
        return '#FFD700';
      case 'coins':
        return '#FFA500';
      case 'achievement':
        return '#FF6B6B';
      default:
        return '#007AFF';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'xp':
        return 'rgba(255, 215, 0, 0.1)';
      case 'coins':
        return 'rgba(255, 165, 0, 0.1)';
      case 'achievement':
        return 'rgba(255, 107, 107, 0.1)';
      default:
        return 'rgba(0, 122, 255, 0.1)';
    }
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.toast, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.content}>
          <Icon 
            name={getIconName()} 
            size={24} 
            color={getColor()} 
          />
          <View style={styles.textContainer}>
            <Text variant="body" weight="semibold" style={{ color: getColor() }}>
              +{amount} {type.toUpperCase()}
            </Text>
            <Text variant="small" style={styles.reason}>
              {reason}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    zIndex: 1000,
  },
  toast: {
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  reason: {
    color: '#666',
    marginTop: 2,
  },
});
