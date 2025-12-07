// Mascot Components - Animated SVG Fox Characters
import React from 'react';
import { FoxNeutral } from './FoxNeutral';
import { FoxExcited } from './FoxExcited';
import { FoxConfident } from './FoxConfident';
import { FoxThinking } from './FoxThinking';
import { FoxWinner } from './FoxWinner';
import { FoxLearning } from './FoxLearning';
import { FoxWorried } from './FoxWorried';
import { FoxSleepy } from './FoxSleepy';
import { FoxCelebrating } from './FoxCelebrating';
import { FoxMotivating } from './FoxMotivating';

export type FoxVariant = 
  | 'neutral' 
  | 'excited' 
  | 'confident' 
  | 'thinking' 
  | 'winner' 
  | 'learning'
  | 'worried'
  | 'sleepy'
  | 'celebrating'
  | 'motivating';

export interface FoxMascotProps {
  variant?: FoxVariant;
  size?: number;
}

export const FoxMascot = ({ variant = 'neutral', size = 120 }: FoxMascotProps) => {
  switch (variant) {
    case 'excited':
      return <FoxExcited size={size} />;
    case 'confident':
      return <FoxConfident size={size} />;
    case 'thinking':
      return <FoxThinking size={size} />;
    case 'winner':
      return <FoxWinner size={size} />;
    case 'learning':
      return <FoxLearning size={size} />;
    case 'worried':
      return <FoxWorried size={size} />;
    case 'sleepy':
      return <FoxSleepy size={size} />;
    case 'celebrating':
      return <FoxCelebrating size={size} />;
    case 'motivating':
      return <FoxMotivating size={size} />;
    case 'neutral':
    default:
      return <FoxNeutral size={size} />;
  }
};

// Export individual mascots
export {
  FoxNeutral,
  FoxExcited,
  FoxConfident,
  FoxThinking,
  FoxWinner,
  FoxLearning,
  FoxWorried,
  FoxSleepy,
  FoxCelebrating,
  FoxMotivating,
};

