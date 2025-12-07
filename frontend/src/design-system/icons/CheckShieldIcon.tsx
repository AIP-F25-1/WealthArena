import React from 'react';
import Svg, { Path, Polyline } from 'react-native-svg';
import { View } from 'react-native';

export const CheckShieldIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M24 4 L8 10 v10 c0 11 8 18 16 20 8-2 16-9 16-20V10L24 4z" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinejoin="round" 
        strokeLinecap="round" 
        fill="none" 
      />
      <Polyline 
        points="16,24 22,30 32,18" 
        stroke={color} 
        strokeWidth={3} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  </View>
);

