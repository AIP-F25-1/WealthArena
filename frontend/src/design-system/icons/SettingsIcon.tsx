import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { View } from 'react-native';

export const SettingsIcon = ({ size = 24, color = '#6B7280' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="6" stroke={color} strokeWidth={2.5} fill="none" />
      <Path 
        d="M24 8 L24 4 M24 44 L24 40 M40 24 L44 24 M4 24 L8 24 M35 13 L38 10 M10 38 L13 35 M35 35 L38 38 M10 10 L13 13" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinecap="round" 
      />
    </Svg>
  </View>
);

