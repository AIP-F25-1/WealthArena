// FoxSleepy - Tired, resting state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Line } from 'react-native-svg';
import { View } from 'react-native';

export const FoxSleepy = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Soft purple sleepy */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#9CA3AF" />
      
      {/* Head - tilted */}
      <Circle cx="95" cy="72" r="50" fill="#D1D5DB" />
      
      {/* Ears - relaxed */}
      <Ellipse cx="65" cy="40" rx="20" ry="35" fill="#9CA3AF" transform="rotate(-20 65 40)" />
      <Ellipse cx="125" cy="40" rx="20" ry="35" fill="#9CA3AF" transform="rotate(-5 125 40)" />
      <Ellipse cx="65" cy="45" rx="10" ry="20" fill="#FFFFFF" />
      <Ellipse cx="125" cy="45" rx="10" ry="20" fill="#FFFFFF" />
      
      {/* Eyes - Closed, sleeping */}
      <Line x1="75" y1="68" x2="90" y2="68" stroke="#4A4A4A" strokeWidth="3" strokeLinecap="round" />
      <Line x1="100" y1="68" x2="115" y2="68" stroke="#4A4A4A" strokeWidth="3" strokeLinecap="round" />
      
      {/* Snout */}
      <Ellipse cx="95" cy="85" rx="20" ry="15" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="95" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Peaceful smile */}
      <Path d="M 85 92 Q 95 96, 105 92" stroke="#4A4A4A" strokeWidth="2" fill="none" strokeLinecap="round" />
      
      {/* Arms - relaxed */}
      <Ellipse cx="70" cy="135" rx="15" ry="30" fill="#D1D5DB" />
      <Ellipse cx="130" cy="135" rx="15" ry="30" fill="#D1D5DB" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#9CA3AF" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#9CA3AF" />
      
      {/* ZZZ sleep symbols */}
      <Path d="M 135 50 L 150 50 L 135 60 L 150 60" stroke="#9CA3AF" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
      <Path d="M 145 35 L 157 35 L 145 43 L 157 43" stroke="#9CA3AF" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
      <Path d="M 155 20 L 165 20 L 155 27 L 165 27" stroke="#9CA3AF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
    </Svg>
  </View>
);

