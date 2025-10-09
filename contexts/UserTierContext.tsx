import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  tier: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  xp: number;
  level: number;
  achievements: string[];
  joinDate: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
}

interface UserTierContextType {
  profile: UserProfile;
  isLoading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addXP: (amount: number) => void;
  addAchievement: (achievement: string) => void;
  resetProfile: () => void;
}

const defaultProfile: UserProfile = {
  tier: 'beginner',
  xp: 0,
  level: 1,
  achievements: [],
  joinDate: new Date().toISOString(),
  totalTrades: 0,
  winRate: 0,
  totalPnL: 0,
};

const UserTierContext = createContext<UserTierContextType | undefined>(undefined);

export function UserTierProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);

  // Load profile from storage on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // Save profile to storage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveProfile();
    }
  }, [profile, isLoading]);

  const loadProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        setProfile({ ...defaultProfile, ...parsedProfile });
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const addXP = (amount: number) => {
    setProfile(prev => {
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;
      
      // Determine tier based on level
      let newTier: UserProfile['tier'] = 'beginner';
      if (newLevel >= 10) newTier = 'expert';
      else if (newLevel >= 7) newTier = 'advanced';
      else if (newLevel >= 4) newTier = 'intermediate';
      
      return {
        ...prev,
        xp: newXP,
        level: newLevel,
        tier: newTier,
      };
    });
  };

  const addAchievement = (achievement: string) => {
    setProfile(prev => ({
      ...prev,
      achievements: [...prev.achievements, achievement],
    }));
  };

  const resetProfile = () => {
    setProfile(defaultProfile);
  };

  return (
    <UserTierContext.Provider value={{
      profile,
      isLoading,
      updateProfile,
      addXP,
      addAchievement,
      resetProfile,
    }}>
      {children}
    </UserTierContext.Provider>
  );
}

export function useUserTier() {
  const context = useContext(UserTierContext);
  if (context === undefined) {
    throw new Error('useUserTier must be used within a UserTierProvider');
  }
  return context;
}
