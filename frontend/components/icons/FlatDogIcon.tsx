import React from 'react';
import Svg, {
  Circle,
  Rect,
  Path,
  Ellipse,
} from 'react-native-svg';

interface FlatDogIconProps {
  size?: number;
}

export const FlatDogIcon: React.FC<FlatDogIconProps> = ({ size = 48 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    {/* Dog's head - large rounded rectangle */}
    <Rect x="20" y="15" width="60" height="45" rx="20" ry="20" fill="#1CB0F6" stroke="#000000" strokeWidth="4" />
    
    {/* Dog's body - large rounded oval */}
    <Ellipse cx="50" cy="75" rx="35" ry="20" fill="#1CB0F6" stroke="#000000" strokeWidth="4" />
    
    {/* Chest stripe - lighter blue curved */}
    <Path d="M 25 70 Q 50 65 75 70" fill="#4A9DFF" stroke="#000000" strokeWidth="3" />
    
    {/* Collar - light purple */}
    <Rect x="25" y="50" width="50" height="8" rx="4" ry="4" fill="#C724F5" stroke="#000000" strokeWidth="2" />
    
    {/* Legs - short stubby rectangles */}
    <Rect x="30" y="85" width="8" height="12" rx="4" ry="4" fill="#1CB0F6" stroke="#000000" strokeWidth="3" />
    <Rect x="42" y="85" width="8" height="12" rx="4" ry="4" fill="#1CB0F6" stroke="#000000" strokeWidth="3" />
    <Rect x="54" y="85" width="8" height="12" rx="4" ry="4" fill="#1CB0F6" stroke="#000000" strokeWidth="3" />
    <Rect x="66" y="85" width="8" height="12" rx="4" ry="4" fill="#1CB0F6" stroke="#000000" strokeWidth="3" />
    
    {/* Tail - rounded rectangle wagging */}
    <Rect x="15" y="65" width="12" height="6" rx="3" ry="3" fill="#1CB0F6" stroke="#000000" strokeWidth="3" />
    
    {/* Eyes - large white ovals with black pupils */}
    <Ellipse cx="35" cy="30" rx="8" ry="12" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
    <Ellipse cx="65" cy="30" rx="8" ry="12" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
    
    {/* Pupils - black ovals */}
    <Ellipse cx="35" cy="30" rx="3" ry="5" fill="#000000" />
    <Ellipse cx="65" cy="30" rx="3" ry="5" fill="#000000" />
    
    {/* Nose - small black oval */}
    <Ellipse cx="50" cy="45" rx="3" ry="2" fill="#000000" />
    
    {/* Bone - white horizontal rectangle */}
    <Rect x="15" y="50" width="70" height="8" rx="4" ry="4" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
    
    {/* Tongue - light pink U-shape */}
    <Path d="M 45 58 Q 50 65 55 58" fill="#FF69B4" stroke="#000000" strokeWidth="2" />
  </Svg>
);

export default FlatDogIcon;
