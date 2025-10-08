import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { View } from 'react-native';

export const PortfolioIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="18" stroke={color} strokeWidth={2.5} fill="none" />
      <Path d="M24 24 L24 6 A18 18 0 0 1 38 15 Z" fill={color} opacity={0.3} />
      <Path d="M24 24 L38 15 A18 18 0 0 1 36 32 Z" fill={color} opacity={0.5} />
      <Path d="M24 24 L36 32 A18 18 0 0 1 12 32 Z" fill={color} opacity={0.7} />
    </Svg>
  </View>
);

