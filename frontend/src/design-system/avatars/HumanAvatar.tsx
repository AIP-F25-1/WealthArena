import React from 'react';
import Svg, { Circle, Path, Rect, LinearGradient, Stop, Defs } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';

interface Props {
  size?: number;
}

export const HumanAvatar: React.FC<Props> = ({ size = 120 }) => {
  const { theme, mode } = useTheme();
  const s = size;
  const r = s / 2;
  return (
    <Svg width={s} height={s} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={mode === 'dark' ? '#111827' : '#F3F4F6'} />
          <Stop offset="100%" stopColor={mode === 'dark' ? '#0B1220' : '#E5E7EB'} />
        </LinearGradient>
        <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={theme.accent} />
          <Stop offset="100%" stopColor={theme.primary} />
        </LinearGradient>
      </Defs>
      <Circle cx={60} cy={60} r={r} fill="url(#bg)" />
      <Circle cx={60} cy={60} r={r - 3} stroke="url(#ring)" strokeWidth={3} fill="none" />
      {/* shoulders */}
      <Rect x={30} y={78} width={60} height={24} rx={12} fill={mode === 'dark' ? '#1F2937' : '#D1D5DB'} />
      {/* neck */}
      <Rect x={54} y={66} width={12} height={12} rx={3} fill={mode === 'dark' ? '#D1D5DB' : '#9CA3AF'} />
      {/* head */}
      <Circle cx={60} cy={50} r={18} fill={mode === 'dark' ? '#E5E7EB' : '#FFFFFF'} />
      {/* hair */}
      <Path d="M44 50c0-10 8-18 18-18 7 0 12 3 15 7-1 4-4 6-8 6-6-6-16-6-22 0-1 0-2 3-3 5z" fill="#111827" />
      {/* eyes */}
      <Circle cx={54} cy={50} r={2.2} fill="#111827" />
      <Circle cx={66} cy={50} r={2.2} fill="#111827" />
      {/* smile */}
      <Path d="M52 56c3 4 13 4 16 0" stroke={theme.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* shirt */}
      <Path d="M30 90c6-10 17-16 30-16s24 6 30 16v6H30z" fill={theme.accent} opacity={0.9} />
    </Svg>
  );
};

export default HumanAvatar;


