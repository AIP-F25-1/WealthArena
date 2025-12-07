import React from 'react';
import Svg, { Rect, Line } from 'react-native-svg';
import { View } from 'react-native';

export const ExecuteIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect x="6" y="10" width="36" height="28" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
      <Line x1="6" y1="16" x2="42" y2="16" stroke={color} strokeWidth={2.5} />
      <Line x1="14" y1="24" x2="28" y2="24" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="14" y1="30" x2="34" y2="30" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </View>
);

