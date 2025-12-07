import { useEffect, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface AnimatedGlowProps {
  readonly children: ReactNode;
  readonly glowColor: string;
  readonly glowIntensity?: number;
  readonly pulseSpeed?: number;
  readonly style?: any;
}

export default function AnimatedGlow({
  children,
  glowColor,
  glowIntensity = 20,
  pulseSpeed = 2000,
  style,
}: AnimatedGlowProps) {
  const glowOpacity = useSharedValue(0.6);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    // Pulsing glow animation
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: pulseSpeed / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: pulseSpeed / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: pulseSpeed / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: pulseSpeed / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulseSpeed]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, style]}>
      {/* Animated glow layer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: glowIntensity,
            elevation: glowIntensity,
          },
          animatedGlowStyle,
        ]}
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
});
