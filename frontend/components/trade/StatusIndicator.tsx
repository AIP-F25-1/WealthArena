/**
 * Status Indicator Component
 * Custom SVG status indicators (no emojis)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text, tokens, useTheme } from '@/src/design-system';

interface StatusIndicatorProps {
  status: 'active' | 'paused' | 'completed' | 'idle';
  size?: number;
  showLabel?: boolean;
}

export function StatusIndicator({ 
  status, 
  size = 16, 
  showLabel = true 
}: StatusIndicatorProps) {
  const { theme } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          color: '#EF4444', // Red
          label: 'Live',
          icon: (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="8" fill="#EF4444" />
              <Circle cx="12" cy="12" r="5" fill="#FFFFFF" opacity="0.5" />
            </Svg>
          )
        };
      case 'paused':
        return {
          color: '#F59E0B', // Amber
          label: 'Paused',
          icon: (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
              <Path 
                d="M10 8V16M14 8V16" 
                stroke="#F59E0B" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              <Circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="2" fill="none" />
            </Svg>
          )
        };
      case 'completed':
        return {
          color: '#10B981', // Green
          label: 'Complete',
          icon: (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
              <Path 
                d="M9 12L11 14L15 10" 
                stroke="#10B981" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <Circle cx="12" cy="12" r="10" stroke="#10B981" strokeWidth="2" fill="none" />
            </Svg>
          )
        };
      case 'idle':
      default:
        return {
          color: '#6B7280', // Gray
          label: 'Ready',
          icon: (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" stroke="#6B7280" strokeWidth="2" fill="none" />
            </Svg>
          )
        };
    }
  };

  const config = getStatusConfig();

  if (!showLabel) {
    return config.icon;
  }

  return (
    <View style={styles.container}>
      {config.icon}
      <Text variant="small" weight="semibold" color={config.color}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
});



