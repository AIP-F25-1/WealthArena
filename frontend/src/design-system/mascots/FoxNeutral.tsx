// FoxNeutral - Default calm state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';

export const FoxNeutral = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Blue */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#1CB0F6" />
      
      {/* Head - Lighter Blue */}
      <Circle cx="100" cy="70" r="50" fill="#58D5FF" />
      
      {/* Ears */}
      <Ellipse cx="70" cy="35" rx="20" ry="35" fill="#1CB0F6" />
      <Ellipse cx="130" cy="35" rx="20" ry="35" fill="#1CB0F6" />
      
      {/* Inner ears - White */}
      <Ellipse cx="70" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      <Ellipse cx="130" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      
      {/* Eyes - White circles with dark pupils */}
      <Circle cx="85" cy="65" r="12" fill="#FFFFFF" />
      <Circle cx="115" cy="65" r="12" fill="#FFFFFF" />
      <Circle cx="85" cy="68" r="7" fill="#4A4A4A" />
      <Circle cx="115" cy="68" r="7" fill="#4A4A4A" />
      
      {/* Snout - White */}
      <Ellipse cx="100" cy="85" rx="20" ry="15" fill="#FFFFFF" />
      
      {/* Nose - Dark */}
      <Ellipse cx="100" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Mouth - Simple smile */}
      <Path d="M 90 90 Q 100 95, 110 90" stroke="#4A4A4A" strokeWidth="2" fill="none" strokeLinecap="round" />
      
      {/* Arms */}
      <Ellipse cx="60" cy="130" rx="15" ry="35" fill="#58D5FF" />
      <Ellipse cx="140" cy="130" rx="15" ry="35" fill="#58D5FF" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#1CB0F6" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#1CB0F6" />
    </Svg>
  </View>
);

