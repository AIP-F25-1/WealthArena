/**
 * Gamification Context
 * Manages XP, coins, achievements, and level progression
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';
import { apiService } from '@/services/apiService';

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  coinReward: number;
  unlockedAt?: Date;
  isUnlocked: boolean;
}

export interface Quest {
  id: number;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'special';
  xpReward: number;
  coinReward: number;
  currentProgress: number;
  targetProgress: number;
  isCompleted: boolean;
  expiresAt?: Date;
}

export interface LevelReward {
  level: number;
  xpRequired: number;
  coinReward: number;
  badgeReward?: string;
  unlockFeature?: string;
}

interface GamificationContextType {
  // State
  currentXP: number;
  currentCoins: number;
  currentLevel: number;
  currentStreak: number;
  recentAchievements: Achievement[];
  activeQuests: Quest[];
  levelProgress: number;
  nextLevelXP: number;
  isLoading: boolean;
  
  // Methods
  awardXP: (amount: number, reason: string, showToast?: boolean) => Promise<void>;
  awardCoins: (amount: number, reason: string, showToast?: boolean) => Promise<void>;
  unlockAchievement: (achievementId: number) => Promise<void>;
  completeQuest: (questId: number) => Promise<void>;
  checkLevelUp: () => Promise<boolean>;
  getLevelRewards: () => LevelReward[];
  refreshGamificationData: () => Promise<void>;
  showRewardToast: (type: 'xp' | 'coins' | 'achievement', amount: number, reason: string) => void;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

// Level progression configuration
const LEVEL_CONFIG = [
  { level: 1, xpRequired: 0, coinReward: 0 },
  { level: 2, xpRequired: 100, coinReward: 50 },
  { level: 3, xpRequired: 250, coinReward: 100 },
  { level: 4, xpRequired: 450, coinReward: 150 },
  { level: 5, xpRequired: 700, coinReward: 200 },
  { level: 6, xpRequired: 1000, coinReward: 300 },
  { level: 7, xpRequired: 1350, coinReward: 400 },
  { level: 8, xpRequired: 1750, coinReward: 500 },
  { level: 9, xpRequired: 2200, coinReward: 600 },
  { level: 10, xpRequired: 2700, coinReward: 750 },
];

export function GamificationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, updateUser } = useUser();
  const [currentXP, setCurrentXP] = useState(0);
  const [currentCoins, setCurrentCoins] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [recentAchievements, setRecentAchievements] = useState<Achievement[]>([]);
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate level progress
  const levelProgress = useMemo(() => {
    const currentLevelConfig = LEVEL_CONFIG.find(config => config.level === currentLevel);
    const nextLevelConfig = LEVEL_CONFIG.find(config => config.level === currentLevel + 1);
    
    if (!currentLevelConfig || !nextLevelConfig) return 100;
    
    const xpInCurrentLevel = currentXP - currentLevelConfig.xpRequired;
    const xpNeededForNextLevel = nextLevelConfig.xpRequired - currentLevelConfig.xpRequired;
    
    return Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
  }, [currentXP, currentLevel]);

  const nextLevelXP = useMemo(() => {
    const nextLevelConfig = LEVEL_CONFIG.find(config => config.level === currentLevel + 1);
    return nextLevelConfig ? nextLevelConfig.xpRequired - currentXP : 0;
  }, [currentXP, currentLevel]);

  // Load gamification data from user context
  useEffect(() => {
    if (user) {
      setCurrentXP(user.xp_points || 0);
      setCurrentCoins(user.total_coins || 0);
      setCurrentLevel(user.current_level || 1);
      setCurrentStreak(user.current_streak || 0);
    }
  }, [user]);

  // Award XP to user
  const awardXP = async (amount: number, reason: string, showToast = true) => {
    if (amount <= 0) return;

    try {
      setIsLoading(true);
      
      // Update backend
      const response = await fetch('/api/user/xp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          xpAmount: amount,
          reason,
        }),
      });

      if (response.ok) {
        const newXP = currentXP + amount;
        setCurrentXP(newXP);
        
        // Update user context
        updateUser({ xp_points: newXP });
        
        // Check for level up
        await checkLevelUp();
        
        if (showToast) {
          showRewardToast('xp', amount, reason);
        }
      } else {
        console.error('Failed to award XP');
      }
    } catch (error) {
      console.error('Error awarding XP:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Award coins to user
  const awardCoins = async (amount: number, reason: string, showToast = true) => {
    if (amount <= 0) return;

    try {
      setIsLoading(true);
      
      // Update backend
      const response = await fetch('/api/user/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          coinAmount: amount,
          reason,
        }),
      });

      if (response.ok) {
        const newCoins = currentCoins + amount;
        setCurrentCoins(newCoins);
        
        // Update user context
        updateUser({ total_coins: newCoins });
        
        if (showToast) {
          showRewardToast('coins', amount, reason);
        }
      } else {
        console.error('Failed to award coins');
      }
    } catch (error) {
      console.error('Error awarding coins:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Unlock achievement
  const unlockAchievement = async (achievementId: number) => {
    try {
      const response = await fetch('/api/user/achievements/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ achievementId }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add to recent achievements
        setRecentAchievements(prev => [data.achievement, ...prev.slice(0, 4)]);
        
        // Award XP and coins
        if (data.achievement.xpReward > 0) {
          await awardXP(data.achievement.xpReward, `Achievement: ${data.achievement.title}`, false);
        }
        if (data.achievement.coinReward > 0) {
          await awardCoins(data.achievement.coinReward, `Achievement: ${data.achievement.title}`, false);
        }
        
        showRewardToast('achievement', 0, data.achievement.title);
      }
    } catch (error) {
      console.error('Error unlocking achievement:', error);
    }
  };

  // Complete quest
  const completeQuest = async (questId: number) => {
    try {
      const response = await fetch(`/api/user/quest/${questId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Award XP and coins
        if (data.quest.xpReward > 0) {
          await awardXP(data.quest.xpReward, `Quest: ${data.quest.title}`, false);
        }
        if (data.quest.coinReward > 0) {
          await awardCoins(data.quest.coinReward, `Quest: ${data.quest.title}`, false);
        }
        
        // Update active quests
        setActiveQuests(prev => prev.filter(quest => quest.id !== questId));
        
        showRewardToast('xp', data.quest.xpReward, `Quest completed: ${data.quest.title}`);
      }
    } catch (error) {
      console.error('Error completing quest:', error);
    }
  };

  // Check for level up
  const checkLevelUp = async (): Promise<boolean> => {
    const newLevel = calculateLevel(currentXP);
    
    if (newLevel > currentLevel) {
      setCurrentLevel(newLevel);
      updateUser({ current_level: newLevel });
      
      // Award level up rewards
      const levelConfig = LEVEL_CONFIG.find(config => config.level === newLevel);
      if (levelConfig && levelConfig.coinReward > 0) {
        await awardCoins(levelConfig.coinReward, `Level ${newLevel} reached!`, false);
      }
      
      // Show level up celebration
      showRewardToast('achievement', 0, `Level ${newLevel} reached!`);
      
      return true;
    }
    
    return false;
  };

  // Calculate level from XP
  const calculateLevel = (xp: number): number => {
    for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_CONFIG[i].xpRequired) {
        return LEVEL_CONFIG[i].level;
      }
    }
    return 1;
  };

  // Get level rewards
  const getLevelRewards = (): LevelReward[] => {
    return LEVEL_CONFIG.map(config => ({
      level: config.level,
      xpRequired: config.xpRequired,
      coinReward: config.coinReward,
      badgeReward: config.level >= 5 ? `Level ${config.level} Badge` : undefined,
      unlockFeature: config.level >= 10 ? 'Advanced Trading Tools' : undefined,
    }));
  };

  // Refresh gamification data
  const refreshGamificationData = async () => {
    try {
      setIsLoading(true);
      
      // Use API_CONFIG to ensure correct URL resolution
      const { API_CONFIG } = await import('@/config/apiConfig');
      const backendUrl = API_CONFIG.BACKEND_BASE_URL;
      
      // Fetch achievements
      try {
        const achievementsResponse = await fetch(`${backendUrl}/api/user/achievements`, {
          headers: {
            'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (achievementsResponse.ok) {
          const contentType = achievementsResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const achievementsData = await achievementsResponse.json();
            if (Array.isArray(achievementsData)) {
              setRecentAchievements(achievementsData.slice(0, 5));
            } else if (achievementsData.data && Array.isArray(achievementsData.data)) {
              setRecentAchievements(achievementsData.data.slice(0, 5));
            }
          } else {
            console.warn('Achievements response is not JSON, skipping');
          }
        }
      } catch (achievementsError) {
        console.warn('Failed to fetch achievements:', achievementsError);
      }
      
      // Fetch quests
      try {
        const questsResponse = await fetch(`${backendUrl}/api/user/quests`, {
          headers: {
            'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (questsResponse.ok) {
          const contentType = questsResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const questsData = await questsResponse.json();
            if (Array.isArray(questsData)) {
              setActiveQuests(questsData);
            } else if (questsData.data && Array.isArray(questsData.data)) {
              setActiveQuests(questsData.data);
            }
          } else {
            console.warn('Quests response is not JSON, skipping');
          }
        }
      } catch (questsError) {
        console.warn('Failed to fetch quests:', questsError);
      }
    } catch (error: any) {
      console.error('Error refreshing gamification data:', error);
      // Don't throw - just log the error so the app continues to work
    } finally {
      setIsLoading(false);
    }
  };

  // Show reward toast notification
  const showRewardToast = (type: 'xp' | 'coins' | 'achievement', amount: number, reason: string) => {
    // This would integrate with a toast notification system
    // For now, we'll just log it
    console.log(`🎉 ${type.toUpperCase()}: +${amount} - ${reason}`);
    
    // In a real implementation, this would show a floating animation
    // showing the reward earned
  };

  // Auto-refresh data when user changes
  useEffect(() => {
    if (user && user.user_id) {
      refreshGamificationData();
    }
  }, [user?.user_id]);

  const contextValue = useMemo(
    () => ({
      currentXP,
      currentCoins,
      currentLevel,
      currentStreak,
      recentAchievements,
      activeQuests,
      levelProgress,
      nextLevelXP,
      isLoading,
      awardXP,
      awardCoins,
      unlockAchievement,
      completeQuest,
      checkLevelUp,
      getLevelRewards,
      refreshGamificationData,
      showRewardToast,
    }),
    [
      currentXP,
      currentCoins,
      currentLevel,
      currentStreak,
      recentAchievements,
      activeQuests,
      levelProgress,
      nextLevelXP,
      isLoading,
    ]
  );

  return (
    <GamificationContext.Provider value={contextValue}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}
