/**
 * Leaderboard Context
 * Manages global and friends leaderboard data with real-time updates
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';
import { getGlobalLeaderboard, getFriendsLeaderboard, getUserRank } from '@/services/apiService';

export interface LeaderboardEntry {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  avatarType?: 'mascot' | 'custom';
  avatarVariant?: string;
  xpPoints: number;
  currentLevel: number;
  totalCoins: number;
  winRate: number;
  totalTrades: number;
  currentStreak: number;
  rank: number;
  tier: string;
}

export interface LeaderboardFilters {
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all';
  category: 'xp' | 'coins' | 'winrate' | 'trades';
  limit: number;
}

interface LeaderboardContextType {
  // State
  globalLeaderboard: LeaderboardEntry[];
  friendsLeaderboard: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  
  // Methods
  refreshLeaderboard: (filters?: LeaderboardFilters) => Promise<void>;
  refreshUserRank: () => Promise<void>;
  getLeaderboardByCategory: (category: string) => LeaderboardEntry[];
  isUserInTopThree: () => boolean;
  getUserRankChange: () => number;
}

const LeaderboardContext = createContext<LeaderboardContextType | undefined>(undefined);

export function LeaderboardProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useUser();
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Cache duration: 30 seconds
  const CACHE_DURATION = 30 * 1000;
  const CACHE_KEY = 'leaderboard_cache';

  // Check if cache is valid
  const isCacheValid = (cachedData: any): boolean => {
    if (!cachedData || !cachedData.timestamp) return false;
    const now = new Date().getTime();
    const cacheTime = new Date(cachedData.timestamp).getTime();
    return (now - cacheTime) < CACHE_DURATION;
  };

  // Load from cache
  const loadFromCache = async (): Promise<any> => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (isCacheValid(data)) {
          return data;
        }
      }
    } catch (error) {
      console.error('Error loading leaderboard cache:', error);
    }
    return null;
  };

  // Save to cache
  const saveToCache = async (data: any) => {
    try {
      const cacheData = {
        ...data,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving leaderboard cache:', error);
    }
  };

  // Fetch global leaderboard
  const fetchGlobalLeaderboard = async (filters: LeaderboardFilters = {
    timeframe: 'all',
    category: 'xp',
    limit: 100,
  }): Promise<LeaderboardEntry[]> => {
    try {
      const response = await getGlobalLeaderboard(filters);
      return response.data?.leaderboard || [];
    } catch (error) {
      console.error('Error fetching global leaderboard:', error);
      return [];
    }
  };

  // Fetch friends leaderboard
  const fetchFriendsLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
      const response = await getFriendsLeaderboard();
      return response.data || [];
    } catch (error) {
      console.error('Error fetching friends leaderboard:', error);
      return [];
    }
  };

  // Fetch user rank
  const fetchUserRank = async (): Promise<LeaderboardEntry | null> => {
    if (!user?.user_id) return null;

    try {
      const response = await getUserRank(user.user_id);
      return response.data || null;
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return null;
    }
  };

  // Refresh leaderboard data
  const refreshLeaderboard = async (filters?: LeaderboardFilters) => {
    setIsLoading(true);
    
    try {
      // Try to load from cache first
      const cachedData = await loadFromCache();
      if (cachedData && !filters) {
        setGlobalLeaderboard(cachedData.globalLeaderboard || []);
        setFriendsLeaderboard(cachedData.friendsLeaderboard || []);
        setUserRank(cachedData.userRank || null);
        setLastUpdated(new Date(cachedData.timestamp));
        setIsLoading(false);
        return;
      }

      // Fetch fresh data
      const [globalData, friendsData, userRankData] = await Promise.all([
        fetchGlobalLeaderboard(filters),
        fetchFriendsLeaderboard(),
        fetchUserRank(),
      ]);

      setGlobalLeaderboard(globalData);
      setFriendsLeaderboard(friendsData);
      setUserRank(userRankData);
      setLastUpdated(new Date());

      // Save to cache
      await saveToCache({
        globalLeaderboard: globalData,
        friendsLeaderboard: friendsData,
        userRank: userRankData,
      });
    } catch (error) {
      console.error('Error refreshing leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh only user rank (for real-time updates)
  const refreshUserRank = async () => {
    try {
      const userRankData = await fetchUserRank();
      setUserRank(userRankData);
    } catch (error) {
      console.error('Error refreshing user rank:', error);
    }
  };

  // Get leaderboard by category
  const getLeaderboardByCategory = (category: string): LeaderboardEntry[] => {
    const leaderboard = [...globalLeaderboard];
    
    switch (category) {
      case 'xp':
        return leaderboard.sort((a, b) => b.xpPoints - a.xpPoints);
      case 'coins':
        return leaderboard.sort((a, b) => b.totalCoins - a.totalCoins);
      case 'winrate':
        return leaderboard.sort((a, b) => b.winRate - a.winRate);
      case 'trades':
        return leaderboard.sort((a, b) => b.totalTrades - a.totalTrades);
      default:
        return leaderboard;
    }
  };

  // Check if user is in top 3
  const isUserInTopThree = (): boolean => {
    if (!userRank) return false;
    return userRank.rank <= 3;
  };

  // Get user rank change (would need to track previous rank)
  const getUserRankChange = (): number => {
    // This would require storing previous rank and comparing
    // For now, return 0 (no change)
    return 0;
  };

  // Auto-refresh every 30 seconds when user is active
  useEffect(() => {
    if (!user?.user_id) return;

    // Initial load
    refreshLeaderboard();

    // Set up auto-refresh
    const interval = setInterval(() => {
      refreshLeaderboard();
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [user?.user_id]);

  // Refresh user rank when user earns XP (this would be called from GamificationContext)
  useEffect(() => {
    if (user?.xp_points) {
      // Debounce the refresh to avoid too many API calls
      const timeoutId = setTimeout(() => {
        refreshUserRank();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [user?.xp_points]);

  const contextValue = useMemo(
    () => ({
      globalLeaderboard,
      friendsLeaderboard,
      userRank,
      isLoading,
      lastUpdated,
      refreshLeaderboard,
      refreshUserRank,
      getLeaderboardByCategory,
      isUserInTopThree,
      getUserRankChange,
    }),
    [
      globalLeaderboard,
      friendsLeaderboard,
      userRank,
      isLoading,
      lastUpdated,
    ]
  );

  return (
    <LeaderboardContext.Provider value={contextValue}>
      {children}
    </LeaderboardContext.Provider>
  );
}

export function useLeaderboard() {
  const context = useContext(LeaderboardContext);
  if (context === undefined) {
    throw new Error('useLeaderboard must be used within a LeaderboardProvider');
  }
  return context;
}
