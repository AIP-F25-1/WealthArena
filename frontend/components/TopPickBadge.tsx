import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

interface TopPickBadgeProps {
  style?: any;
}

export default function TopPickBadge({ style }: TopPickBadgeProps) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glowOpacity = useSharedValue(0.8);

  useEffect(() => {
    // Scale pulsing animation
    scale.value = withRepeat(
      withSequence(
        withSpring(1.1, { damping: 2, stiffness: 100 }),
        withSpring(1, { damping: 2, stiffness: 100 })
      ),
      -1,
      false
    );

    // Rotation animation
    rotate.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Glow pulsing
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, style, animatedStyle]}>
      {/* Animated glow background */}
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient
          colors={[Colors.neonPurple, Colors.neonCyan, Colors.neonPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glowGradient}
        />
      </Animated.View>

      {/* Badge content */}
      <LinearGradient
        colors={[Colors.neonPurple, Colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.badge}
      >
        <Text style={styles.badgeText}>⭐ TOP PICK ⭐</Text>
        <View style={styles.sparkles}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.sparkle}>✨</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glowContainer: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 20,
    shadowColor: Colors.neonPurple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
  },
  badge: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '900' as const,
    color: Colors.text,
    letterSpacing: 1,
    textShadowColor: Colors.neonCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  sparkles: {
    flexDirection: 'row',
    gap: 4,
  },
  sparkle: {
    fontSize: 16,
  },
});
