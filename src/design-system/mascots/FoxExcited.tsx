// FoxExcited - Happy, celebrating state
import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { View } from 'react-native';

export const FoxExcited = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Green (excited) */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#58CC02" />
      
      {/* Head - Light Green */}
      <Circle cx="100" cy="70" r="50" fill="#7FD957" />
      
      {/* Ears - bouncy */}
      <Ellipse cx="70" cy="40" rx="18" ry="32" fill="#58CC02" transform="rotate(-10 70 40)" />
      <Ellipse cx="130" cy="40" rx="18" ry="32" fill="#58CC02" transform="rotate(10 130 40)" />
      
      {/* Inner ears */}
      <Ellipse cx="70" cy="46" rx="9" ry="18" fill="#FFFFFF" />
      <Ellipse cx="130" cy="46" rx="9" ry="18" fill="#FFFFFF" />
      
      {/* Eyes - Big happy eyes */}
      <Circle cx="85" cy="65" r="14" fill="#FFFFFF" />
      <Circle cx="115" cy="65" r="14" fill="#FFFFFF" />
      <Circle cx="85" cy="67" r="8" fill="#4A4A4A" />
      <Circle cx="115" cy="67" r="8" fill="#4A4A4A" />
      {/* Sparkles in eyes */}
      <Circle cx="88" cy="64" r="3" fill="#FFFFFF" />
      <Circle cx="118" cy="64" r="3" fill="#FFFFFF" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="22" ry="16" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="9" ry="7" fill="#4A4A4A" />
      
      {/* Big smile */}
      <Path d="M 85 92 Q 100 102, 115 92" stroke="#4A4A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Arms - raised up in celebration */}
      <Ellipse cx="55" cy="110" rx="15" ry="35" fill="#7FD957" transform="rotate(-30 55 110)" />
      <Ellipse cx="145" cy="110" rx="15" ry="35" fill="#7FD957" transform="rotate(30 145 110)" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#58CC02" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#58CC02" />
      
      {/* Excitement sparkles */}
      <Circle cx="40" cy="70" r="4" fill="#FFC800" />
      <Circle cx="160" cy="70" r="4" fill="#FFC800" />
      <Circle cx="50" cy="50" r="3" fill="#FFC800" />
      <Circle cx="150" cy="50" r="3" fill="#FFC800" />
    </Svg>
  </View>
);

