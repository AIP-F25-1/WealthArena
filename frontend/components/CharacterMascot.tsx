import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface CharacterMascotProps {
  readonly character?: 'confident' | 'excited' | 'happy' | 'learning' | 'motivating' | 'thinking' | 'winner' | 'worried' | 'neutral' | 'sleeping' | 'cautious' | 'celebration';
  readonly size?: number;
  readonly style?: any;
  readonly animated?: boolean;
}

// Character emoji mapping as fallback until images are available
const CHARACTER_EMOJIS = {
  confident: '😎',
  excited: '🤩',
  happy: '😊',
  learning: '🤓',
  motivating: '💪',
  thinking: '🤔',
  winner: '🏆',
  worried: '😟',
  neutral: '😐',
  sleeping: '😴',
  cautious: '😰',
  celebration: '🎉',
};

export default function CharacterMascot({
  character = 'confident',
  size = 120,
  style,
  animated = true,
}: CharacterMascotProps) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      // Floating animation
      translateY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );

      // Subtle rotation
      rotate.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-5, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, style, animated && animatedStyle]}>
      <Text 
        style={[styles.emoji, { fontSize: size * 0.7 }]}
        allowFontScaling={true}
        adjustsFontSizeToFit={false}
      >
        {CHARACTER_EMOJIS[character]}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible', // Allow emoji to render properly
  },
  emoji: {
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: undefined, // Let React Native handle line height for emojis
    includeFontPadding: false, // Remove extra padding on Android
  },
});
