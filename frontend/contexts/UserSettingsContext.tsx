import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: 'short' | 'medium' | 'long';
  maxDrawdown: number; // percentage
  volatilityTolerance: 'low' | 'medium' | 'high';
  liquidityNeeds: 'high' | 'medium' | 'low';
  esgPreference: 'none' | 'moderate' | 'high';
  sectorPreferences: string[];
  assetClassPreferences: {
    stocks: number; // percentage
    bonds: number;
    crypto: number;
    commodities: number;
    etfs: number;
    forex: number;
  };
  rebalancingFrequency: 'monthly' | 'quarterly' | 'annually';
  taxConsiderations: boolean;
  geographicBias: 'domestic' | 'international' | 'global';
}

interface UserSettings {
  showNews: boolean;
  riskProfile: RiskProfile;
  personalizedRecommendations: {
    enabled: boolean;
    lastUpdated: string | null;
    recommendations: any[];
  };
}

interface UserSettingsContextType {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  updateRiskProfile: (updates: Partial<RiskProfile>) => void;
  updateRecommendations: (recommendations: any[]) => void;
  toggleNews: () => void;
  resetToDefault: () => void;
}

const defaultRiskProfile: RiskProfile = {
  riskTolerance: 'moderate',
  investmentHorizon: 'medium',
  maxDrawdown: 15,
  volatilityTolerance: 'medium',
  liquidityNeeds: 'medium',
  esgPreference: 'none',
  sectorPreferences: [],
  assetClassPreferences: {
    stocks: 60,
    bonds: 20,
    crypto: 5,
    commodities: 5,
    etfs: 8,
    forex: 2,
  },
  rebalancingFrequency: 'quarterly',
  taxConsiderations: false,
  geographicBias: 'domestic',
};

const defaultSettings: UserSettings = {
  showNews: false, // Default to hidden
  riskProfile: defaultRiskProfile,
  personalizedRecommendations: {
    enabled: true,
    lastUpdated: null,
    recommendations: [],
  },
};

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Save settings to storage whenever they change
  useEffect(() => {
    saveSettings();
  }, [settings]);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('userSettings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
  };

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const updateRiskProfile = (updates: Partial<RiskProfile>) => {
    setSettings(prev => ({
      ...prev,
      riskProfile: { ...prev.riskProfile, ...updates }
    }));
  };

  const updateRecommendations = (recommendations: any[]) => {
    setSettings(prev => ({
      ...prev,
      personalizedRecommendations: {
        ...prev.personalizedRecommendations,
        recommendations,
        lastUpdated: new Date().toISOString(),
      }
    }));
  };

  const toggleNews = () => {
    setSettings(prev => ({
      ...prev,
      showNews: !prev.showNews
    }));
  };

  const resetToDefault = () => {
    setSettings(defaultSettings);
  };

  return (
    <UserSettingsContext.Provider value={{
      settings,
      updateSettings,
      updateRiskProfile,
      updateRecommendations,
      toggleNews,
      resetToDefault
    }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}
