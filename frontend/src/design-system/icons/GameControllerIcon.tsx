import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { View } from 'react-native';

export const GameControllerIcon = ({ size = 24, color = '#58CC02' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Game controller body */}
      <Path 
        d="M12 14 L36 14 C40 14, 44 18, 44 22 L44 26 C44 30, 40 34, 36 34 L12 34 C8 34, 4 30, 4 26 L4 22 C4 18, 8 14, 12 14 Z" 
        fill={color}
      />
      
      {/* D-pad (left side) */}
      <Rect x="10" y="20" width="6" height="2" fill="#1A1A1A" rx="1" />
      <Rect x="12" y="18" width="2" height="6" fill="#1A1A1A" rx="1" />
      
      {/* Action buttons (right side) */}
      <Circle cx="34" cy="20" r="2.5" fill="#FF4B4B" />
      <Circle cx="38" cy="24" r="2.5" fill="#58CC02" />
      <Circle cx="30" cy="24" r="2.5" fill="#1CB0F6" />
      <Circle cx="34" cy="28" r="2.5" fill="#FFC800" />
      
      {/* Grips */}
      <Path 
        d="M4 26 C4 30, 6 32, 8 34" 
        stroke={color} 
        strokeWidth="2" 
        fill="none"
        strokeLinecap="round"
      />
      <Path 
        d="M44 26 C44 30, 42 32, 40 34" 
        stroke={color} 
        strokeWidth="2" 
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  </View>
);

