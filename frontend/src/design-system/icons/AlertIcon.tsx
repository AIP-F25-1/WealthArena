import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { View } from 'react-native';

export const AlertIcon = ({ size = 24, color = '#FF4B4B' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="18" stroke={color} strokeWidth={2.5} fill="none" />
      <Line x1="24" y1="14" x2="24" y2="28" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Circle cx="24" cy="34" r="2" fill={color} />
    </Svg>
  </View>
);

