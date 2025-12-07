import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { View } from 'react-native';

export const LabIcon = ({ size = 24, color = '#1CB0F6' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M18 8 L18 20 L10 36 C8 40, 10 42, 14 42 L34 42 C38 42, 40 40, 38 36 L30 20 L30 8 Z" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinejoin="round" 
        fill="none" 
      />
      <Path d="M16 8 L32 8" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx="24" cy="28" r="2" fill={color} />
      <Circle cx="18" cy="34" r="1.5" fill={color} />
      <Circle cx="30" cy="34" r="1.5" fill={color} />
    </Svg>
  </View>
);

