import React from 'react';
import Svg, { Circle, Path, Rect, LinearGradient, Stop, Defs, G } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';

interface Props {
  size?: number;
}

export const RobotAvatar: React.FC<Props> = ({ size = 120 }) => {
  const { theme, mode } = useTheme();
  const s = size;
  const r = s / 2;
  return (
    <Svg width={s} height={s} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="bgR" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={mode === 'dark' ? '#0B1220' : '#F3F4F6'} />
          <Stop offset="100%" stopColor={mode === 'dark' ? '#0A1628' : '#E5E7EB'} />
        </LinearGradient>
        <LinearGradient id="ringR" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={theme.accent} />
          <Stop offset="100%" stopColor={theme.primary} />
        </LinearGradient>
      </Defs>
      <Circle cx={60} cy={60} r={r} fill="url(#bgR)" />
      <Circle cx={60} cy={60} r={r - 3} stroke="url(#ringR)" strokeWidth={3} fill="none" />
      {/* body */}
      <Rect x={36} y={76} width={48} height={22} rx={6} fill={mode === 'dark' ? '#1F2A44' : '#D1D5DB'} />
      {/* head casing */}
      <Rect x={40} y={38} width={40} height={28} rx={12} fill={mode === 'dark' ? '#E5F4FF' : '#FFFFFF'} />
      <Rect x={42} y={40} width={36} height={24} rx={10} fill={theme.accent} />
      {/* eyes */}
      <G fill="#FFFFFF">
        <Rect x={50} y={48} width={6} height={6} rx={3} />
        <Rect x={64} y={48} width={6} height={6} rx={3} />
      </G>
      {/* antenna */}
      <Path d="M60 34v6" stroke={theme.accent} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={60} cy={32} r={3} fill={theme.accent} />
      {/* arms */}
      <Rect x={30} y={70} width={10} height={8} rx={4} fill="#E5F4FF" />
      <Rect x={80} y={70} width={10} height={8} rx={4} fill="#E5F4FF" />
      {/* torso panel */}
      <Rect x={48} y={74} width={24} height={12} rx={4} fill={theme.accent} />
    </Svg>
  );
};

export default RobotAvatar;


