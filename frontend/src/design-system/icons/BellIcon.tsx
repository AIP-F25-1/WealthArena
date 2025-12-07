import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { View } from 'react-native';

export const BellIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Bell body */}
      <Path 
        d="M24 6 C18 6, 14 10, 14 16 L14 22 L12 26 L12 28 L36 28 L36 26 L34 22 L34 16 C34 10, 30 6, 24 6 Z" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinejoin="round" 
        fill="none"
      />
      {/* Bell clapper */}
      <Circle cx="24" cy="32" r="2" fill={color} />
      {/* Bell mount */}
      <Path d="M18 8 L30 8" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  </View>
);
