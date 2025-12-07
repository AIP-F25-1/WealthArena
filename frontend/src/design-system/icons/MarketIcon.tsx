import React from 'react';
import Svg, { Polyline, Line } from 'react-native-svg';
import { View } from 'react-native';

export const MarketIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Polyline 
        points="6,32 14,22 22,26 30,14 42,20" 
        stroke={color} 
        strokeWidth={3} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <Line x1="6" y1="38" x2="42" y2="38" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </View>
);

