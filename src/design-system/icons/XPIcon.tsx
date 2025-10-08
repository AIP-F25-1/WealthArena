import React from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import { View } from 'react-native';

export const XPIcon = ({ size = 24, color = '#7C3AED' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Star/burst shape for XP */}
      <Polygon
        points="24,4 28,18 42,18 31,26 35,40 24,32 13,40 17,26 6,18 20,18"
        fill={color}
      />
      
      {/* Inner star for depth */}
      <Polygon
        points="24,10 26,20 34,20 28,25 30,35 24,30 18,35 20,25 14,20 22,20"
        fill="#9F7AEA"
      />
      
      {/* XP text in center */}
      <Path 
        d="M18 22 L22 28 M22 22 L18 28" 
        stroke="#FFFFFF" 
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path 
        d="M26 22 L26 28 M26 22 C26 22, 28 22, 28 24 C28 26, 26 26, 26 26" 
        stroke="#FFFFFF" 
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  </View>
);

