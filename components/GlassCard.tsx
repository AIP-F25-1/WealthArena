import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

interface GlassCardProps {
  children: React.ReactNode;
  glowColor?: string;
  borderWidth?: number;
  style?: any;
  variant?: 'blue' | 'purple' | 'green' | 'red' | 'gold' | 'pink';
}

export default function GlassCard({
  children,
  glowColor,
  borderWidth = 3,
  style,
  variant = 'blue',
}: GlassCardProps) {
  
  // Map variants to colors from mockup
  const getBorderColor = () => {
    if (glowColor) return glowColor;
    switch (variant) {
      case 'purple': return Colors.cardBorderPurple;
      case 'green': return Colors.cardBorderGreen;
      case 'red': return Colors.cardBorderRed;
      case 'gold': return Colors.cardBorderGold;
      case 'pink': return Colors.cardBorderPink;
      case 'blue':
      default: return Colors.cardBorderBlue;
    }
  };

  const getShadowColor = () => {
    if (glowColor) return glowColor;
    switch (variant) {
      case 'purple': return Colors.glow.purple;
      case 'green': return Colors.glow.green;
      case 'red': return Colors.glow.red;
      case 'gold': return Colors.glow.gold;
      case 'pink': return Colors.glow.pink;
      case 'blue':
      default: return Colors.glow.cyan;
    }
  };

  const borderColor = getBorderColor();
  const shadowColor = getShadowColor();

  return (
    <View style={[styles.container, style]}>
      {/* INTENSE Multi-layer glow effect (like in mockup) */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glow,
          {
            shadowColor: shadowColor,
            shadowOpacity: Platform.OS === 'ios' ? 0.9 : 0.8,
            shadowRadius: 25,
            shadowOffset: { width: 0, height: 0 },
            elevation: 25,
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glow,
          {
            shadowColor: shadowColor,
            shadowOpacity: Platform.OS === 'ios' ? 0.7 : 0.6,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 0 },
            elevation: 15,
          },
        ]}
      />

      {/* Glass background with gradient (darker like mockup) */}
      <LinearGradient
        colors={['rgba(0, 8, 20, 0.85)', 'rgba(0, 8, 20, 0.7)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            borderWidth: borderWidth,
            borderColor: borderColor,
            borderRadius: 20,
          }
        ]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  glow: {
    borderRadius: 20,
  },
  gradient: {
    padding: 20,
  },
});
