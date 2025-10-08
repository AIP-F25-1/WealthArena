import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { View } from 'react-native';

export const SignalIcon = ({ size = 24, color = '#1CB0F6' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M8 24 Q 16 12, 24 24 T 40 24" 
        stroke={color} 
        strokeWidth={3} 
        strokeLinecap="round" 
        fill="none" 
      />
      <Circle cx="24" cy="24" r="3" fill={color} />
      <Circle cx="8" cy="24" r="2" fill={color} />
      <Circle cx="40" cy="24" r="2" fill={color} />
    </Svg>
  </View>
);

