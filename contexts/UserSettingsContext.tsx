import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserSettings {
  showNews: boolean;
}

interface UserSettingsContextType {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  toggleNews: () => void;
  resetToDefault: () => void;
}

const defaultSettings: UserSettings = {
  showNews: false, // Default to hidden
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
