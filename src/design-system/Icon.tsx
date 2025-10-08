// Icon Component - Unified icon interface
import React from 'react';
import { MarketIcon } from './icons/MarketIcon';
import { SignalIcon } from './icons/SignalIcon';
import { AgentIcon } from './icons/AgentIcon';
import { ReplayIcon } from './icons/ReplayIcon';
import { PortfolioIcon } from './icons/PortfolioIcon';
import { ShieldIcon } from './icons/ShieldIcon';
import { ExecuteIcon } from './icons/ExecuteIcon';
import { TrophyIcon } from './icons/TrophyIcon';
import { LeaderboardIcon } from './icons/LeaderboardIcon';
import { NewsIcon } from './icons/NewsIcon';
import { CheckShieldIcon } from './icons/CheckShieldIcon';
import { LabIcon } from './icons/LabIcon';
import { AlertIcon } from './icons/AlertIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { SendIcon } from './icons/SendIcon';
import { GoogleIcon } from './icons/GoogleIcon';
import { BellIcon } from './icons/BellIcon';
import { CoinIcon } from './icons/CoinIcon';
import { XPIcon } from './icons/XPIcon';
import { GameControllerIcon } from './icons/GameControllerIcon';
import { RobotIcon } from './icons/RobotIcon';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export const Icon = ({ name, size = 24, color }: IconProps) => {
  const c = color || '#58CC02';
  
  switch (name) {
    case 'market':
      return <MarketIcon size={size} color={c} />;
    case 'signal':
      return <SignalIcon size={size} color={c} />;
    case 'agent':
      return <AgentIcon size={size} color={c} />;
    case 'replay':
      return <ReplayIcon size={size} color={c} />;
    case 'portfolio':
      return <PortfolioIcon size={size} color={c} />;
    case 'shield':
      return <ShieldIcon size={size} color={c} />;
    case 'execute':
      return <ExecuteIcon size={size} color={c} />;
    case 'trophy':
      return <TrophyIcon size={size} color={c} />;
    case 'leaderboard':
      return <LeaderboardIcon size={size} color={c} />;
    case 'news':
      return <NewsIcon size={size} color={c} />;
    case 'check-shield':
      return <CheckShieldIcon size={size} color={c} />;
    case 'lab':
      return <LabIcon size={size} color={c} />;
    case 'alert':
      return <AlertIcon size={size} color={c} />;
    case 'settings':
      return <SettingsIcon size={size} color={c} />;
    case 'send':
      return <SendIcon size={size} color={c} />;
    case 'google':
      return <GoogleIcon size={size} color={c} />;
    case 'bell':
      return <BellIcon size={size} color={c} />;
    case 'coin':
      return <CoinIcon size={size} color={c} />;
    case 'xp':
      return <XPIcon size={size} color={c} />;
    case 'game-controller':
      return <GameControllerIcon size={size} color={c} />;
    case 'robot':
      return <RobotIcon size={size} color={c} />;
    default:
      return null;
  }
};

// Export individual icons for direct use
export {
  MarketIcon,
  SignalIcon,
  AgentIcon,
  ReplayIcon,
  PortfolioIcon,
  ShieldIcon,
  ExecuteIcon,
  TrophyIcon,
  LeaderboardIcon,
  NewsIcon,
  CheckShieldIcon,
  LabIcon,
  AlertIcon,
  SettingsIcon,
  SendIcon,
  GoogleIcon,
  BellIcon,
  CoinIcon,
  XPIcon,
  GameControllerIcon,
  RobotIcon,
};

