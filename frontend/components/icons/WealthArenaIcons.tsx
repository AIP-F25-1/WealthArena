import React from 'react';
import Svg, {
  Circle,
  Rect,
  Path,
  Polygon,
  Text as SvgText,
  Ellipse,
} from 'react-native-svg';

// Base SVG component with consistent viewBox and styling
interface BaseIconProps {
  size?: number;
  color?: string;
}

const BaseIcon: React.FC<{
  children: React.ReactNode;
  size?: number;
  viewBox?: string;
}> = ({ children, size = 24, viewBox = "0 0 512 512" }) => (
  <Svg width={size} height={size} viewBox={viewBox}>
    {children}
  </Svg>
);

// ===========================================
// MAIN MASCOT CHARACTERS (Simplified SVG versions)
// ===========================================

// 1. Bull Character - "Wealth Bull" (Primary Mascot) - Ultra Flat Style
export const WealthBull: React.FC<BaseIconProps> = ({ size = 48, color = "#00CD66" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Body - Large rounded rectangle (ultra flat) */}
    <Rect x="25" y="50" width="50" height="35" rx="15" ry="15" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Head - Large rounded rectangle */}
    <Rect x="20" y="15" width="60" height="40" rx="20" ry="20" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Eyes - Large white rectangles with thick outline */}
    <Rect x="32" y="25" width="12" height="16" rx="6" ry="6" fill="#FFFFFF" stroke="#000000" strokeWidth="4" />
    <Rect x="56" y="25" width="12" height="16" rx="6" ry="6" fill="#FFFFFF" stroke="#000000" strokeWidth="4" />
    
    {/* Pupils - Black rectangles */}
    <Rect x="36" y="29" width="4" height="8" rx="2" ry="2" fill="#000000" />
    <Rect x="60" y="29" width="4" height="8" rx="2" ry="2" fill="#000000" />
    
    {/* Horns - Simple triangles */}
    <Path d="M 35 15 L 30 8 L 40 15 Z" fill={color} stroke="#000000" strokeWidth="4" />
    <Path d="M 65 15 L 70 8 L 60 15 Z" fill={color} stroke="#000000" strokeWidth="4" />
    
    {/* Nose - Small black rectangle */}
    <Rect x="47" y="42" width="6" height="4" rx="2" ry="2" fill="#000000" />
    
    {/* Mouth - Simple curved line */}
    <Path d="M 40 48 Q 50 52 60 48" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
    
    {/* Legs - Simple rectangles */}
    <Rect x="35" y="80" width="8" height="15" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="57" y="80" width="8" height="15" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 2. Bear Character - "Market Bear" (Secondary Mascot) - Ultra Flat Style
export const MarketBear: React.FC<BaseIconProps> = ({ size = 48, color = "#8B4513" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Body - Large rounded rectangle (ultra flat) */}
    <Rect x="25" y="50" width="50" height="35" rx="15" ry="15" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Head - Large rounded rectangle */}
    <Rect x="20" y="15" width="60" height="40" rx="20" ry="20" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Ears - Simple rectangles */}
    <Rect x="25" y="10" width="12" height="15" rx="6" ry="6" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="63" y="10" width="12" height="15" rx="6" ry="6" fill={color} stroke="#000000" strokeWidth="4" />
    
    {/* Eyes - Large white rectangles with thick outline */}
    <Rect x="32" y="25" width="12" height="16" rx="6" ry="6" fill="#FFFFFF" stroke="#000000" strokeWidth="4" />
    <Rect x="56" y="25" width="12" height="16" rx="6" ry="6" fill="#FFFFFF" stroke="#000000" strokeWidth="4" />
    
    {/* Pupils - Black rectangles */}
    <Rect x="36" y="29" width="4" height="8" rx="2" ry="2" fill="#000000" />
    <Rect x="60" y="29" width="4" height="8" rx="2" ry="2" fill="#000000" />
    
    {/* Nose - Small black triangle */}
    <Path d="M 47 42 L 53 42 L 50 46 Z" fill="#000000" stroke="#000000" strokeWidth="2" />
    
    {/* Mouth - Simple curved line */}
    <Path d="M 40 48 Q 50 52 60 48" fill="none" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
    
    {/* Legs - Simple rectangles */}
    <Rect x="35" y="80" width="8" height="15" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="57" y="80" width="8" height="15" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// ===========================================
// FINANCIAL GAME ICONS
// ===========================================

// 27. Coin Stack - Three stacked rectangles (ultra flat)
export const CoinStack: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Bottom coin - thick rectangle */}
    <Rect x="20" y="60" width="60" height="25" rx="12" ry="12" fill={color} stroke="#000000" strokeWidth="5" />
    <Rect x="30" y="65" width="40" height="15" rx="7" ry="7" fill="#FFD700" stroke="#000000" strokeWidth="3" />
    
    {/* Middle coin */}
    <Rect x="25" y="40" width="50" height="20" rx="10" ry="10" fill={color} stroke="#000000" strokeWidth="5" />
    <Rect x="32" y="44" width="36" height="12" rx="6" ry="6" fill="#FFD700" stroke="#000000" strokeWidth="3" />
    
    {/* Top coin */}
    <Rect x="30" y="20" width="40" height="18" rx="9" ry="9" fill={color} stroke="#000000" strokeWidth="5" />
    <Rect x="35" y="24" width="30" height="10" rx="5" ry="5" fill="#FFD700" stroke="#000000" strokeWidth="3" />
    
    {/* Dollar signs - simple rectangles representing text */}
    <Rect x="47" y="68" width="6" height="8" rx="1" ry="1" fill="#000000" />
    <Rect x="47" y="48" width="6" height="8" rx="1" ry="1" fill="#000000" />
    <Rect x="47" y="28" width="6" height="8" rx="1" ry="1" fill="#000000" />
  </BaseIcon>
);

// 28. Money Bag - Simple rounded rectangle bag (ultra flat)
export const MoneyBag: React.FC<BaseIconProps> = ({ size = 24, color = "#00CD66" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Bag body - large rounded rectangle */}
    <Rect x="25" y="35" width="50" height="50" rx="15" ry="15" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Bag opening - smaller rectangle on top */}
    <Rect x="30" y="25" width="40" height="15" rx="7" ry="7" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Tied handles - simple rectangles */}
    <Rect x="20" y="35" width="8" height="6" rx="3" ry="3" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="72" y="35" width="8" height="6" rx="3" ry="3" fill={color} stroke="#000000" strokeWidth="4" />
    
    {/* Dollar sign - simple rectangle */}
    <Rect x="47" y="55" width="6" height="20" rx="1" ry="1" fill="#000000" />
  </BaseIcon>
);

// 29. Upward Chart Arrow - Ultra flat rectangles
export const UpwardChart: React.FC<BaseIconProps> = ({ size = 24, color = "#7FD957" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Chart bars - thick ascending rectangles */}
    <Rect x="20" y="60" width="15" height="30" rx="2" ry="2" fill="#1CB0F6" stroke="#000000" strokeWidth="5" />
    <Rect x="40" y="40" width="15" height="50" rx="2" ry="2" fill="#1CB0F6" stroke="#000000" strokeWidth="5" />
    <Rect x="60" y="20" width="15" height="70" rx="2" ry="2" fill="#1CB0F6" stroke="#000000" strokeWidth="5" />
    
    {/* Arrow - simple triangle pointing up-right */}
    <Path d="M 80 15 L 95 15 L 95 30 L 85 30 L 85 20 Z" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 30. Downward Chart Arrow - Ultra flat rectangles
export const DownwardChart: React.FC<BaseIconProps> = ({ size = 24, color = "#FF4B4B" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Chart bars - thick descending rectangles */}
    <Rect x="20" y="20" width="15" height="70" rx="2" ry="2" fill="#FF9600" stroke="#000000" strokeWidth="5" />
    <Rect x="40" y="40" width="15" height="50" rx="2" ry="2" fill="#FF9600" stroke="#000000" strokeWidth="5" />
    <Rect x="60" y="60" width="15" height="30" rx="2" ry="2" fill="#FF9600" stroke="#000000" strokeWidth="5" />
    
    {/* Arrow - simple triangle pointing down-right */}
    <Path d="M 80 70 L 95 70 L 95 85 L 85 85 L 85 75 Z" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 31. Pie Chart - Simple divided rectangle (ultra flat)
export const PieChart: React.FC<BaseIconProps> = ({ size = 24 }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Main rectangle */}
    <Rect x="20" y="20" width="60" height="60" rx="10" ry="10" fill="#7FD957" stroke="#000000" strokeWidth="5" />
    
    {/* Divider lines */}
    <Path d="M 50 20 L 50 80" fill="none" stroke="#000000" strokeWidth="4" />
    <Path d="M 20 50 L 80 50" fill="none" stroke="#000000" strokeWidth="4" />
    
    {/* Color sections - simple rectangles */}
    <Rect x="50" y="20" width="30" height="30" rx="5" ry="5" fill="#1CB0F6" stroke="#000000" strokeWidth="3" />
    <Rect x="20" y="50" width="30" height="30" rx="5" ry="5" fill="#FF9600" stroke="#000000" strokeWidth="3" />
  </BaseIcon>
);

// 32. Bar Chart - Three thick vertical rectangles (ultra flat)
export const BarChart: React.FC<BaseIconProps> = ({ size = 24 }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Rect x="15" y="40" width="20" height="50" rx="3" ry="3" fill="#7FD957" stroke="#000000" strokeWidth="5" />
    <Rect x="40" y="20" width="20" height="70" rx="3" ry="3" fill="#1CB0F6" stroke="#000000" strokeWidth="5" />
    <Rect x="65" y="30" width="20" height="60" rx="3" ry="3" fill="#FF9600" stroke="#000000" strokeWidth="5" />
  </BaseIcon>
);

// 33. Target with Arrow - Ultra flat nested rectangles
export const TargetArrow: React.FC<BaseIconProps> = ({ size = 24 }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Target - nested rectangles */}
    <Rect x="10" y="10" width="80" height="80" rx="40" ry="40" fill="none" stroke="#000000" strokeWidth="5" />
    <Rect x="20" y="20" width="60" height="60" rx="30" ry="30" fill="none" stroke="#000000" strokeWidth="5" />
    <Rect x="30" y="30" width="40" height="40" rx="20" ry="20" fill="#FF4B4B" stroke="#000000" strokeWidth="5" />
    <Rect x="40" y="40" width="20" height="20" rx="10" ry="10" fill="#000000" />
    
    {/* Arrow - simple triangle */}
    <Path d="M 75 25 L 90 10 L 90 20 L 85 20 Z" fill="#1CB0F6" stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// ===========================================
// ACHIEVEMENT & PROGRESS ICONS
// ===========================================

// 11. Streak Flame
export const StreakFlame: React.FC<BaseIconProps> = ({ size = 24, color = "#FF9600" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Flame shape - simplified geometric */}
    <Path d="M 50 85 Q 30 70 35 50 Q 40 30 50 20 Q 60 30 65 50 Q 70 70 50 85 Z" fill={color} stroke="#000000" strokeWidth="4" />
    <Path d="M 50 75 Q 40 65 42 50 Q 45 35 50 30 Q 55 35 58 50 Q 60 65 50 75 Z" fill="#FFD700" stroke="#000000" strokeWidth="3" />
  </BaseIcon>
);

// 15. Star (Filled) - Ultra flat 4-pointed star
export const StarFilled: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Simple 4-pointed star using rectangles */}
    <Rect x="45" y="10" width="10" height="80" rx="5" ry="5" fill={color} stroke="#000000" strokeWidth="5" />
    <Rect x="10" y="45" width="80" height="10" rx="5" ry="5" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Center square */}
    <Rect x="40" y="40" width="20" height="20" rx="3" ry="3" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 16. Star (Outlined)
export const StarOutlined: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Polygon 
      points="50,10 61,35 88,35 68,55 74,82 50,67 26,82 32,55 12,35 39,35" 
      fill="none" 
      stroke="#000000" 
      strokeWidth="4" 
    />
  </BaseIcon>
);

// 17. Three Stars
export const ThreeStars: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 120 100">
    {/* Small star */}
    <Polygon 
      points="30,50 35,60 45,60 37,67 40,77 30,72 20,77 23,67 15,60 25,60" 
      fill={color} 
      stroke="#000000" 
      strokeWidth="3" 
    />
    
    {/* Medium star */}
    <Polygon 
      points="60,40 65,50 75,50 67,57 70,67 60,62 50,67 53,57 45,50 55,50" 
      fill={color} 
      stroke="#000000" 
      strokeWidth="3" 
    />
    
    {/* Large star */}
    <Polygon 
      points="90,30 95,40 105,40 97,47 100,57 90,52 80,57 83,47 75,40 85,40" 
      fill={color} 
      stroke="#000000" 
      strokeWidth="3" 
    />
  </BaseIcon>
);

// 18. Crown - Ultra flat simple crown
export const Crown: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Crown base */}
    <Rect x="15" y="60" width="70" height="25" rx="5" ry="5" fill={color} stroke="#000000" strokeWidth="5" />
    
    {/* Crown points - simple rectangles */}
    <Rect x="20" y="40" width="15" height="25" rx="3" ry="3" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="42" y="25" width="16" height="40" rx="3" ry="3" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="65" y="40" width="15" height="25" rx="3" ry="3" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 22. Lightning Bolt - Ultra flat zigzag
export const LightningBolt: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Simple zigzag lightning using rectangles */}
    <Rect x="45" y="10" width="10" height="30" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="30" y="40" width="25" height="10" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="45" y="50" width="10" height="30" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
    <Rect x="60" y="80" width="25" height="10" rx="2" ry="2" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 23. Shield
export const Shield: React.FC<BaseIconProps> = ({ size = 24, color = "#1CB0F6" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Path d="M 50 10 L 70 20 L 70 50 Q 70 70 50 85 Q 30 70 30 50 L 30 20 Z" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 24. Checkmark in Circle
export const CheckmarkCircle: React.FC<BaseIconProps> = ({ size = 24, color = "#7FD957" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="35" fill={color} stroke="#000000" strokeWidth="4" />
    <Path d="M 30 50 L 45 65 L 70 35" fill="none" stroke="#000000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </BaseIcon>
);

// 25. X in Circle
export const XCircle: React.FC<BaseIconProps> = ({ size = 24, color = "#FF4B4B" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="35" fill={color} stroke="#000000" strokeWidth="4" />
    <Path d="M 35 35 L 65 65 M 65 35 L 35 65" fill="none" stroke="#000000" strokeWidth="6" strokeLinecap="round" />
  </BaseIcon>
);

// ===========================================
// EMOTION & REACTION ICONS
// ===========================================

// 51. Thumbs Up
export const ThumbsUp: React.FC<BaseIconProps> = ({ size = 24, color = "#7FD957" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Thumb */}
    <Path d="M 30 40 Q 30 20 40 20 L 55 20 Q 65 20 65 30 L 65 80 Q 65 90 55 90 L 30 90 Q 20 90 20 80 Z" fill={color} stroke="#000000" strokeWidth="4" />
    
    {/* Hand */}
    <Rect x="55" y="30" width="20" height="50" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 52. Party Popper
export const PartyPopper: React.FC<BaseIconProps> = ({ size = 24 }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Cone */}
    <Path d="M 50 80 L 40 40 L 60 40 Z" fill="#FF9600" stroke="#000000" strokeWidth="4" />
    
    {/* Confetti dots */}
    <Circle cx="70" cy="30" r="4" fill="#FF4B4B" stroke="#000000" strokeWidth="2" />
    <Circle cx="75" cy="25" r="3" fill="#1CB0F6" stroke="#000000" strokeWidth="2" />
    <Circle cx="80" cy="35" r="4" fill="#FFD700" stroke="#000000" strokeWidth="2" />
    <Circle cx="65" cy="40" r="3" fill="#7FD957" stroke="#000000" strokeWidth="2" />
  </BaseIcon>
);

// 53. Fire (Hot Streak) - Same as streak flame
export const Fire: React.FC<BaseIconProps> = StreakFlame;

// ===========================================
// UTILITY ICONS
// ===========================================

// 44. Question Mark
export const QuestionMark: React.FC<BaseIconProps> = ({ size = 24, color = "#1CB0F6" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="35" fill={color} stroke="#000000" strokeWidth="4" />
    <SvgText x="50" y="65" fontSize="40" fill="#000000" textAnchor="middle" fontWeight="bold">?</SvgText>
  </BaseIcon>
);

// 45. Exclamation Mark
export const ExclamationMark: React.FC<BaseIconProps> = ({ size = 24, color = "#FF9600" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="35" fill={color} stroke="#000000" strokeWidth="4" />
    <SvgText x="50" y="65" fontSize="40" fill="#000000" textAnchor="middle" fontWeight="bold">!</SvgText>
  </BaseIcon>
);

// 49. Heart
export const Heart: React.FC<BaseIconProps> = ({ size = 24, color = "#FF4B4B" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    <Path d="M 50 85 Q 50 70 35 55 Q 20 40 20 25 Q 20 10 35 10 Q 50 25 50 25 Q 50 25 65 10 Q 80 10 80 25 Q 80 40 65 55 Q 50 70 50 85 Z" fill={color} stroke="#000000" strokeWidth="4" />
  </BaseIcon>
);

// 50. Bell
export const Bell: React.FC<BaseIconProps> = ({ size = 24, color = "#FFD700" }) => (
  <BaseIcon size={size} viewBox="0 0 100 100">
    {/* Bell body */}
    <Path d="M 35 20 Q 35 10 50 10 Q 65 10 65 20 L 65 60 Q 65 70 50 70 Q 35 70 35 60 Z" fill={color} stroke="#000000" strokeWidth="4" />
    
    {/* Bell top */}
    <Rect x="45" y="10" width="10" height="15" fill={color} stroke="#000000" strokeWidth="4" />
    
    {/* Clapper */}
    <Circle cx="50" cy="65" r="3" fill="#000000" />
  </BaseIcon>
);

// Export all icons as a single object for easy importing
export const WealthArenaIcons = {
  // Mascots
  WealthBull,
  MarketBear,
  
  // Financial
  CoinStack,
  MoneyBag,
  UpwardChart,
  DownwardChart,
  PieChart,
  BarChart,
  TargetArrow,
  
  // Achievements
  StreakFlame,
  StarFilled,
  StarOutlined,
  ThreeStars,
  Crown,
  LightningBolt,
  Shield,
  CheckmarkCircle,
  XCircle,
  
  // Emotions
  ThumbsUp,
  PartyPopper,
  Fire,
  
  // Utility
  QuestionMark,
  ExclamationMark,
  Heart,
  Bell,
};

export default WealthArenaIcons;
