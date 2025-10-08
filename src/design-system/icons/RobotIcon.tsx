import React from 'react';
import Svg, { Rect, Circle, Line } from 'react-native-svg';
import { View } from 'react-native';

export const RobotIcon = ({ size = 28, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Antenna */}
      <Line x1="24" y1="4" x2="24" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="24" cy="4" r="2" fill={color} />
      
      {/* Robot Head */}
      <Rect x="10" y="10" width="28" height="28" rx="4" fill={color} />
      
      {/* Eyes */}
      <Circle cx="18" cy="20" r="3" fill="#000000" />
      <Circle cx="30" cy="20" r="3" fill="#000000" />
      
      {/* Mouth - rectangular grid like 🤖 */}
      <Rect x="16" y="28" width="16" height="6" rx="1" fill="#000000" />
      <Line x1="20" y1="28" x2="20" y2="34" stroke={color} strokeWidth="1" />
      <Line x1="24" y1="28" x2="24" y2="34" stroke={color} strokeWidth="1" />
      <Line x1="28" y1="28" x2="28" y2="34" stroke={color} strokeWidth="1" />
      
      {/* Body connection */}
      <Rect x="22" y="38" width="4" height="6" fill={color} />
    </Svg>
  </View>
);

