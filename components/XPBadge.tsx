import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

interface XPBadgeProps {
  xp: number;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export default function XPBadge({ xp, size = 'medium', style }: XPBadgeProps) {
  const sizes = {
    small: { container: 24, text: 10, icon: 16 },
    medium: { container: 32, text: 12, icon: 20 },
    large: { container: 40, text: 14, icon: 24 },
  };

  const currentSize = sizes[size];

  return (
    <LinearGradient
      colors={[Colors.xpGold, Colors.xpOrange]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        { height: currentSize.container, paddingHorizontal: currentSize.container / 2 },
        style,
      ]}
    >
      <Image
        source={require('@/assets/images/collectibles/Experience Point Crystal.png')}
        style={{ width: currentSize.icon, height: currentSize.icon }}
        resizeMode="contain"
      />
      <Text
        style={[
          styles.xpText,
          { fontSize: currentSize.text },
        ]}
      >
        +{xp} XP
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    shadowColor: Colors.xpGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  xpText: {
    fontWeight: '700' as const,
    color: Colors.primary,
    textShadowColor: Colors.xpOrange,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
});
