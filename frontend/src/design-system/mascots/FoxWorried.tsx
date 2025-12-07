// FoxWorried - Concerned, cautious state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Line } from 'react-native-svg';
import { View } from 'react-native';

export const FoxWorried = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Red/alert */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#FF6B6B" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#FF9090" />
      
      {/* Ears - drooped */}
      <Ellipse cx="70" cy="40" rx="20" ry="35" fill="#FF6B6B" transform="rotate(-15 70 40)" />
      <Ellipse cx="130" cy="40" rx="20" ry="35" fill="#FF6B6B" transform="rotate(15 130 40)" />
      <Ellipse cx="70" cy="45" rx="10" ry="20" fill="#FFFFFF" />
      <Ellipse cx="130" cy="45" rx="10" ry="20" fill="#FFFFFF" />
      
      {/* Eyes - Wide, worried */}
      <Circle cx="85" cy="65" r="14" fill="#FFFFFF" />
      <Circle cx="115" cy="65" r="14" fill="#FFFFFF" />
      <Circle cx="85" cy="67" r="9" fill="#4A4A4A" />
      <Circle cx="115" cy="67" r="9" fill="#4A4A4A" />
      
      {/* Worried eyebrows */}
      <Path d="M 72 52 Q 78 48, 88 50" stroke="#4A4A4A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d="M 112 50 Q 122 48, 128 52" stroke="#4A4A4A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="20" ry="15" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Worried frown */}
      <Path d="M 88 95 Q 100 92, 112 95" stroke="#4A4A4A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Arms - nervous */}
      <Ellipse cx="65" cy="125" rx="15" ry="32" fill="#FF9090" />
      <Ellipse cx="135" cy="125" rx="15" ry="32" fill="#FF9090" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#FF6B6B" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#FF6B6B" />
      
      {/* Sweat drops */}
      <Ellipse cx="130" cy="75" rx="4" ry="7" fill="#58D5FF" opacity="0.7" />
      <Ellipse cx="68" cy="75" rx="4" ry="7" fill="#58D5FF" opacity="0.7" />
    </Svg>
  </View>
);

