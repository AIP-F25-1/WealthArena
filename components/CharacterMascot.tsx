import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
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
  character?: 'confident' | 'excited' | 'happy' | 'learning' | 'motivating' | 'thinking' | 'winner' | 'worried' | 'neutral' | 'sleeping';
  size?: number;
  style?: any;
  animated?: boolean;
}

const CHARACTER_IMAGES = {
  confident: require('@/assets/images/characters/WealthArena_Bunny_Confident.png'),
  excited: require('@/assets/images/characters/WealthArena_Bunny_Excited.png'),
  happy: require('@/assets/images/characters/WealthArena_Bunny_Happy_Celebrating.png'),
  learning: require('@/assets/images/characters/WealthArena_Bunny_Learning.png'),
  motivating: require('@/assets/images/characters/WealthArena_Bunny_Motivating.png'),
  thinking: require('@/assets/images/characters/WealthArena_Bunny_Thinking.png'),
  winner: require('@/assets/images/characters/WealthArena_Bunny_Winner.png'),
  worried: require('@/assets/images/characters/WealthArena_Bunny_Worried.png'),
  neutral: require('@/assets/images/characters/WealthArena_Bunny_Neutral_Profile.png'),
  sleeping: require('@/assets/images/characters/WealthArena_Bunny_Sleeping_Idle.png'),
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
      <Image
        source={CHARACTER_IMAGES[character]}
        style={[styles.image, { width: size, height: size }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
