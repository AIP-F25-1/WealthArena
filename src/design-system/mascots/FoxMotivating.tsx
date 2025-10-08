// FoxMotivating - Encouraging, coaching state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg';
import { View } from 'react-native';

export const FoxMotivating = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Green motivational */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#58CC02" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#7FD957" />
      
      {/* Ears - perked up */}
      <Ellipse cx="70" cy="30" rx="20" ry="36" fill="#58CC02" />
      <Ellipse cx="130" cy="30" rx="20" ry="36" fill="#58CC02" />
      <Ellipse cx="70" cy="36" rx="10" ry="22" fill="#FFFFFF" />
      <Ellipse cx="130" cy="36" rx="10" ry="22" fill="#FFFFFF" />
      
      {/* Eyes - Energetic */}
      <Circle cx="85" cy="65" r="13" fill="#FFFFFF" />
      <Circle cx="115" cy="65" r="13" fill="#FFFFFF" />
      <Circle cx="85" cy="67" r="8" fill="#4A4A4A" />
      <Circle cx="115" cy="67" r="8" fill="#4A4A4A" />
      {/* Eye shine */}
      <Circle cx="88" cy="63" r="4" fill="#FFFFFF" />
      <Circle cx="118" cy="63" r="4" fill="#FFFFFF" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="21" ry="15" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Motivating smile */}
      <Path d="M 85 92 Q 100 100, 115 92" stroke="#4A4A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Arm - pointing up motivationally */}
      <Ellipse cx="135" cy="100" rx="15" ry="40" fill="#7FD957" transform="rotate(-50 135 100)" />
      <Circle cx="145" cy="75" r="12" fill="#7FD957" />
      {/* Finger pointing */}
      <Ellipse cx="148" cy="65" rx="4" ry="12" fill="#7FD957" />
      
      {/* Other arm */}
      <Ellipse cx="65" cy="130" rx="15" ry="35" fill="#7FD957" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#58CC02" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#58CC02" />
      
      {/* Motivational sparkles */}
      <Path d="M 155 60 L 157 65 L 162 66 L 158 69 L 159 74 L 155 71 L 151 74 L 152 69 L 148 66 L 153 65 Z" fill="#FFC800" />
      <Path d="M 170 45 L 171 48 L 174 49 L 171 51 L 172 54 L 170 52 L 168 54 L 169 51 L 166 49 L 169 48 Z" fill="#FFC800" />
      <Circle cx="160" cy="80" r="3" fill="#FFC800" />
    </Svg>
  </View>
);

