import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { View } from 'react-native';

export const AgentIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M10 16 C10 10, 14 6, 24 6 C34 6, 38 10, 38 16 L38 28 C38 32, 34 36, 24 36 C14 36, 10 32, 10 28 Z" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinejoin="round" 
        fill="none" 
      />
      <Path d="M10 26 Q 6 30, 6 36" stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M38 26 Q 42 30, 42 36" stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Circle cx="18" cy="20" r="2" fill={color} />
      <Circle cx="30" cy="20" r="2" fill={color} />
    </Svg>
  </View>
);

