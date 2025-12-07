import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserTier = 'beginner' | 'intermediate' | null;

export interface UserProfile {
  tier: UserTier;
  name: string;
  email: string;
  joinedDate: string;
  achievements: string[];
  completedChallenges: number;
  totalChallenges: number;
}

const STORAGE_KEY = '@wealtharena_user_profile';

export const [UserTierProvider, useUserTier] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile>({
    tier: null,
    name: '',
    email: '',
    joinedDate: new Date().toISOString(),
    achievements: [],
    completedChallenges: 0,
    totalChallenges: 10,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProfile(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async (newProfile: UserProfile) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
      setProfile(newProfile);
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  const setUserTier = useCallback((tier: UserTier) => {
    const updatedProfile = { ...profile, tier };
    saveProfile(updatedProfile);
  }, [profile]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    const updatedProfile = { ...profile, ...updates };
    saveProfile(updatedProfile);
  }, [profile]);

  const addAchievement = useCallback((achievement: string) => {
    if (!profile.achievements.includes(achievement)) {
      const updatedProfile = {
        ...profile,
        achievements: [...profile.achievements, achievement],
      };
      saveProfile(updatedProfile);
    }
  }, [profile]);

  const completeChallenge = useCallback(() => {
    const updatedProfile = {
      ...profile,
      completedChallenges: profile.completedChallenges + 1,
    };
    saveProfile(updatedProfile);
  }, [profile]);

  return useMemo(() => ({
    profile,
    isLoading,
    setUserTier,
    updateProfile,
    addAchievement,
    completeChallenge,
  }), [profile, isLoading, setUserTier, updateProfile, addAchievement, completeChallenge]);
});
