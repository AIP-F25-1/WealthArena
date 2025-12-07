// FoxConfident - Determined, focused state
import React from 'react';
import Svg, { Circle, Ellipse, Path, Line } from 'react-native-svg';
import { View } from 'react-native';

export const FoxConfident = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Orange confident */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#FF9500" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#FFC800" />
      
      {/* Ears - alert, pointed */}
      <Ellipse cx="70" cy="40" rx="18" ry="32" fill="#FF9500" />
      <Ellipse cx="130" cy="40" rx="18" ry="32" fill="#FF9500" />
      <Ellipse cx="70" cy="46" rx="9" ry="18" fill="#FFFFFF" />
      <Ellipse cx="130" cy="46" rx="9" ry="18" fill="#FFFFFF" />
      
      {/* Eyes - Focused, slightly narrowed */}
      <Ellipse cx="85" cy="65" rx="13" ry="11" fill="#FFFFFF" />
      <Ellipse cx="115" cy="65" rx="13" ry="11" fill="#FFFFFF" />
      <Circle cx="85" cy="66" r="7" fill="#4A4A4A" />
      <Circle cx="115" cy="66" r="7" fill="#4A4A4A" />
      
      {/* Eyebrows - confident look */}
      <Line x1="75" y1="55" x2="90" y2="57" stroke="#4A4A4A" strokeWidth="3" strokeLinecap="round" />
      <Line x1="110" y1="57" x2="125" y2="55" stroke="#4A4A4A" strokeWidth="3" strokeLinecap="round" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="20" ry="15" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Confident smirk */}
      <Path d="M 88 92 Q 100 96, 112 92" stroke="#4A4A4A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Arms - on hips, confident pose */}
      <Ellipse cx="65" cy="130" rx="15" ry="32" fill="#FFC800" />
      <Ellipse cx="135" cy="130" rx="15" ry="32" fill="#FFC800" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#FF9500" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#FF9500" />
    </Svg>
  </View>
);

