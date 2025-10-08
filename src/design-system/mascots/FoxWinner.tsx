// FoxWinner - Trophy, champion state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect, Polygon } from 'react-native-svg';
import { View } from 'react-native';

export const FoxWinner = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Gold winner */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#FFC800" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#FFD700" />
      
      {/* Crown on head */}
      <Rect x="70" y="15" width="60" height="8" rx="2" fill="#FFD700" />
      <Path d="M 70 15 L 80 5 L 90 15 L 100 5 L 110 15 L 120 5 L 130 15" fill="#FFC800" />
      <Circle cx="80" cy="5" r="4" fill="#FF4B4B" />
      <Circle cx="100" cy="5" r="4" fill="#FF4B4B" />
      <Circle cx="120" cy="5" r="4" fill="#FF4B4B" />
      
      {/* Ears */}
      <Ellipse cx="70" cy="35" rx="20" ry="35" fill="#FFC800" />
      <Ellipse cx="130" cy="35" rx="20" ry="35" fill="#FFC800" />
      <Ellipse cx="70" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      <Ellipse cx="130" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      
      {/* Eyes - Happy closed eyes (^_^) */}
      <Path d="M 75 65 Q 85 60, 95 65" stroke="#4A4A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d="M 105 65 Q 115 60, 125 65" stroke="#4A4A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="22" ry="16" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="9" ry="7" fill="#4A4A4A" />
      
      {/* Big winner smile */}
      <Path d="M 82 92 Q 100 105, 118 92" stroke="#4A4A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Arms - raised in victory */}
      <Ellipse cx="50" cy="105" rx="15" ry="38" fill="#FFD700" transform="rotate(-35 50 105)" />
      <Ellipse cx="150" cy="105" rx="15" ry="38" fill="#FFD700" transform="rotate(35 150 105)" />
      
      {/* Trophy in hand */}
      <Rect x="42" y="85" width="16" height="20" rx="2" fill="#FFD700" />
      <Rect x="45" y="105" width="10" height="8" rx="2" fill="#FF9500" />
      <Ellipse cx="50" cy="82" rx="10" ry="6" fill="#FFD700" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#FFC800" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#FFC800" />
      
      {/* Celebration stars */}
      <Path d="M 30 60 L 33 67 L 40 68 L 34 73 L 36 80 L 30 76 L 24 80 L 26 73 L 20 68 L 27 67 Z" fill="#FFD700" />
      <Path d="M 170 60 L 173 67 L 180 68 L 174 73 L 176 80 L 170 76 L 164 80 L 166 73 L 160 68 L 167 67 Z" fill="#FFD700" />
    </Svg>
  </View>
);

