import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

export const SendIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M6 24 L42 6 L30 42 L24 24 L6 24 Z" 
        fill={color}
      />
      <Path 
        d="M24 24 L30 42 L6 24 Z" 
        fill={color}
        opacity={0.7}
      />
    </Svg>
  </View>
);
