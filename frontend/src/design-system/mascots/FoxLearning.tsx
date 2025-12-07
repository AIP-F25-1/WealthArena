// FoxLearning - Studying, focused state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect, Line } from 'react-native-svg';
import { View } from 'react-native';

export const FoxLearning = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Blue study mode */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#1CB0F6" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#58D5FF" />
      
      {/* Ears */}
      <Ellipse cx="70" cy="35" rx="20" ry="35" fill="#1CB0F6" />
      <Ellipse cx="130" cy="35" rx="20" ry="35" fill="#1CB0F6" />
      <Ellipse cx="70" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      <Ellipse cx="130" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      
      {/* Glasses - reading */}
      <Circle cx="85" cy="68" r="14" fill="none" stroke="#4A4A4A" strokeWidth="2.5" />
      <Circle cx="115" cy="68" r="14" fill="none" stroke="#4A4A4A" strokeWidth="2.5" />
      <Line x1="99" y1="68" x2="101" y2="68" stroke="#4A4A4A" strokeWidth="2.5" />
      
      {/* Eyes behind glasses */}
      <Circle cx="85" cy="68" r="6" fill="#4A4A4A" />
      <Circle cx="115" cy="68" r="6" fill="#4A4A4A" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="20" ry="15" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Small concentrated smile */}
      <Path d="M 92 92 Q 100 95, 108 92" stroke="#4A4A4A" strokeWidth="2" fill="none" strokeLinecap="round" />
      
      {/* Arms - holding book */}
      <Ellipse cx="70" cy="125" rx="15" ry="30" fill="#58D5FF" />
      <Ellipse cx="130" cy="125" rx="15" ry="30" fill="#58D5FF" />
      
      {/* Book */}
      <Rect x="75" y="110" width="50" height="35" rx="3" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="2" />
      <Line x1="100" y1="110" x2="100" y2="145" stroke="#4A4A4A" strokeWidth="2" />
      <Line x1="80" y1="120" x2="95" y2="120" stroke="#1CB0F6" strokeWidth="1.5" />
      <Line x1="105" y1="120" x2="120" y2="120" stroke="#1CB0F6" strokeWidth="1.5" />
      <Line x1="80" y1="128" x2="95" y2="128" stroke="#1CB0F6" strokeWidth="1.5" />
      <Line x1="105" y1="128" x2="120" y2="128" stroke="#1CB0F6" strokeWidth="1.5" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#1CB0F6" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#1CB0F6" />
    </Svg>
  </View>
);

