import React from 'react';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { View } from 'react-native';

export const TrophyIcon = ({ size = 24, color = '#FFC800' }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path 
        d="M12 10 h24 v6 a12 12 0 0 1-24 0 V10z" 
        fill={color} 
        opacity={0.8}
      />
      <Rect x="18" y="28" width="12" height="8" rx="2" fill={color} />
      <Line x1="14" y1="40" x2="34" y2="40" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M12 10 L8 10 L8 14 Q8 18, 12 18" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M36 10 L40 10 L40 14 Q40 18, 36 18" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  </View>
);

