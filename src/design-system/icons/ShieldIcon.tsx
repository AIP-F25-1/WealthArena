import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

export const ShieldIcon = ({ size = 24, color = '#1CB0F6' }: { size?: number; color?: string }) => (
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
    </Svg>
  </View>
);

