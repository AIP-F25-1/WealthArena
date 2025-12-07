// ProgressRing Component - Circular progress indicator for quests
import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export const ProgressRing = ({ 
  progress, 
  size = 60, 
  strokeWidth = 6,
  showLabel = true,
}: ProgressRingProps) => {
  const { theme } = useTheme();
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.label}>
          <Text variant="small" weight="bold">{Math.round(progress)}%</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

