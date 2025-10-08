// FoxThinking - Pondering, curious state
import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { View } from 'react-native';

export const FoxThinking = ({ size = 120 }: { size?: number }) => (
  <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Body - Purple thoughtful */}
      <Ellipse cx="100" cy="130" rx="60" ry="70" fill="#8B5CF6" />
      
      {/* Head */}
      <Circle cx="100" cy="70" r="50" fill="#A78BFA" />
      
      {/* Ears - one tilted */}
      <Ellipse cx="70" cy="35" rx="20" ry="35" fill="#8B5CF6" />
      <Ellipse cx="130" cy="32" rx="20" ry="35" fill="#8B5CF6" transform="rotate(15 130 32)" />
      <Ellipse cx="70" cy="40" rx="10" ry="20" fill="#FFFFFF" />
      <Ellipse cx="130" cy="37" rx="10" ry="20" fill="#FFFFFF" />
      
      {/* Eyes - Looking up/thinking */}
      <Circle cx="85" cy="62" r="12" fill="#FFFFFF" />
      <Circle cx="115" cy="62" r="12" fill="#FFFFFF" />
      <Circle cx="87" cy="60" r="7" fill="#4A4A4A" />
      <Circle cx="117" cy="60" r="7" fill="#4A4A4A" />
      
      {/* Snout */}
      <Ellipse cx="100" cy="85" rx="20" ry="15" fill="#FFFFFF" />
      
      {/* Nose */}
      <Ellipse cx="100" cy="82" rx="8" ry="6" fill="#4A4A4A" />
      
      {/* Mouth - thinking expression */}
      <Path d="M 95 92 L 105 92" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
      
      {/* Arm - hand on chin */}
      <Ellipse cx="125" cy="95" rx="15" ry="25" fill="#A78BFA" transform="rotate(45 125 95)" />
      <Circle cx="128" cy="88" r="10" fill="#A78BFA" />
      
      {/* Other arm */}
      <Ellipse cx="75" cy="130" rx="15" ry="35" fill="#A78BFA" />
      
      {/* Legs */}
      <Ellipse cx="80" cy="175" rx="18" ry="25" fill="#8B5CF6" />
      <Ellipse cx="120" cy="175" rx="18" ry="25" fill="#8B5CF6" />
      
      {/* Thought bubbles */}
      <Circle cx="150" cy="50" r="6" fill="#FFFFFF" opacity="0.8" />
      <Circle cx="165" cy="40" r="9" fill="#FFFFFF" opacity="0.8" />
      <Circle cx="175" cy="25" r="12" fill="#FFFFFF" opacity="0.8" />
    </Svg>
  </View>
);

