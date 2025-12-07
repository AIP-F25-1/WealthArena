import React from 'react';
import Svg, { Path, Polyline } from 'react-native-svg';
import { View } from 'react-native';

export const ReplayIcon = ({ size = 24, color = '#FFC800' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M38 24 C38 31, 31 38, 24 38 C17 38, 10 31, 10 24 C10 17, 17 10, 24 10 L32 10" 
        stroke={color} 
        strokeWidth={3} 
        strokeLinecap="round" 
        fill="none" 
      />
      <Polyline points="28,6 32,10 28,14" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

