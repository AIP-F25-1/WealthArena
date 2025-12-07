// FoxCelebrating - Party, achievement state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from 'react-native-svg';
import { View } from 'react-native';

export const FoxCelebrating = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Pink party */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#EC4899" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#F472B6" />
      
      {/* Party hat */}
      <Polygon points="100,10 75,45 125,45" fill="#FFC800" />
      <Circle cx="100" cy="10" r="6" fill="#58CC02" />
      <Path d="M 75 45 L 125 45" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      
      {/* Ears - under hat */}
      <Ellipse cx="70" cy="42" rx="18" ry="30" fill="#EC4899" />
      <Ellipse cx="130" cy="42" rx="18" ry="30" fill="#EC4899" />
      
      {/* Eyes - Happy stars */}
      <Path d="M 85 65 L 87 70 L 92 71 L 88 74 L 89 79 L 85 76 L 81 79 L 82 74 L 78 71 L 83 70 Z" fill="#FFC800" />
      <Path d="M 115 65 L 117 70 L 122 71 L 118 74 L 119 79 L 115 76 L 111 79 L 112 74 L 108 71 L 113 70 Z" fill="#FFC800" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="22" ry="16" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="9" ry="7" fill="#4A4A4A" />
      
      {/* Big party smile */}
      <Path d="M 80 92 Q 100 108, 120 92" stroke="#4A4A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Arms - celebrating */}
      <Ellipse cx="52" cy="105" rx="15" ry="40" fill="#F472B6" transform="rotate(-40 52 105)" />
      <Ellipse cx="148" cy="105" rx="15" ry="40" fill="#F472B6" transform="rotate(40 148 105)" />
      
      {/* Confetti pieces */}
      <Circle cx="35" cy="80" r="4" fill="#58CC02" />
      <Circle cx="165" cy="75" r="4" fill="#FFC800" />
      <Rect x="25" y="100" width="6" height="6" fill="#1CB0F6" transform="rotate(25 25 100)" />
      <Rect x="170" y="95" width="6" height="6" fill="#FF4B4B" transform="rotate(-25 170 95)" />
      <Circle cx="45" cy="55" r="3" fill="#FFC800" />
      <Circle cx="155" cy="50" r="3" fill="#58CC02" />
      
      {/* Legs - dancing */}
      <Ellipse cx="75" cy="175" rx="18" ry="25" fill="#EC4899" transform="rotate(-10 75 175)" />
      <Ellipse cx="125" cy="175" rx="18" ry="25" fill="#EC4899" transform="rotate(10 125 175)" />
    </Svg>
  </View>
);

