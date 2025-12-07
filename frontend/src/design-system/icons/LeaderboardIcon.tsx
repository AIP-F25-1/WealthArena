import React from 'react';
import Svg, { Rect, Circle } from 'react-native-svg';
import { View } from 'react-native';

export const LeaderboardIcon = ({ size = 24, color = '#FFC800' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect x="16" y="12" width="16" height="30" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
      <Rect x="4" y="24" width="10" height="18" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
      <Rect x="34" y="20" width="10" height="22" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
      <Circle cx="24" cy="8" r="3" fill={color} />
    </Svg>
  </View>
);

