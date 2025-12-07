import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { View } from 'react-native';

export const CoinIcon = ({ size = 24, color = '#FFC800' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Main coin body - solid gold */}
      <Circle cx="24" cy="24" r="20" fill={color} />
      
      {/* Inner ring */}
      <Circle cx="24" cy="24" r="16" fill="none" stroke="#FFD700" strokeWidth="2" />
      
      {/* Simple dollar sign */}
      <Path 
        d="M24 10 L24 38" 
        stroke="#8B6914" 
        strokeWidth="3" 
        strokeLinecap="round"
      />
      <Path 
        d="M20 16 C20 14, 22 13, 24 13 C26 13, 28 14, 28 16 C28 18, 26 19, 24 19 L24 19 C22 19, 20 20, 20 22 C20 24, 22 25, 24 25 C26 25, 28 26, 28 28 C28 30, 26 31, 24 31 C22 31, 20 30, 20 28" 
        stroke="#8B6914" 
        strokeWidth="3" 
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Highlight */}
      <Circle cx="18" cy="16" r="3" fill="#FFFACD" opacity="0.6" />
    </Svg>
  </View>
);

