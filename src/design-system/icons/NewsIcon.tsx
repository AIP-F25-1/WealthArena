import React from 'react';
import Svg, { Rect, Line } from 'react-native-svg';
import { View } from 'react-native';

export const NewsIcon = ({ size = 24, color = '#1CB0F6' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect x="8" y="10" width="32" height="32" rx="3" stroke={color} strokeWidth={2.5} fill="none" />
      <Line x1="14" y1="18" x2="34" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="14" y1="24" x2="28" y2="24" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="14" y1="30" x2="34" y2="30" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="14" y1="35" x2="24" y2="35" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </View>
);

