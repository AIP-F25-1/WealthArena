// CRITICAL: Import polyfills FIRST before any other imports
import '../polyfills';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { UserProvider } from "@/contexts/UserContext";
import { UserTierProvider } from "@/contexts/UserTierContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { GamificationProvider } from "@/contexts/GamificationContext";
import { LeaderboardProvider } from "@/contexts/LeaderboardContext";
import { ThemeProvider, useTheme } from "@/src/design-system";
import ErrorBoundary from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function DynamicStatusBar() {
  const { theme } = useTheme();
  const isDarkMode = theme.bg === '#071019' || theme.bg === '#000000';
  return (
    <StatusBar 
      style={isDarkMode ? "light" : "dark"} 
      backgroundColor={theme.bg} 
      translucent={false} 
    />
  );
}

function RootLayoutNav() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="splash" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="landing" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="learning-topics" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="ai-chat" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="daily-quests" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="trade-signals" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="search-instruments" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="portfolio-builder" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="strategy-lab" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="strategy-detail" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="analytics" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="trade-simulator" options={{ headerShown: false }} />
      <Stack.Screen name="explainability" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="admin-portal" options={{ headerShown: false }} />
      <Stack.Screen name="trade-setup" options={{ headerShown: false }} />
      <Stack.Screen name="trade-detail" options={{ headerShown: false }} />
      <Stack.Screen name="technical-analysis" options={{ headerShown: false }} />
      <Stack.Screen name="user-profile" options={{ headerShown: false }} />
      <Stack.Screen name="vs-ai-start" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="vs-ai-gameover" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="vs-ai-battle" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="vs-ai-play" options={{ headerShown: false, presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (Platform.OS === 'android') {
      const setSystemUI = async () => {
        try {
          await SystemUI.setBackgroundColorAsync('#000000');
          setTimeout(async () => {
            await SystemUI.setBackgroundColorAsync('#000000');
          }, 500);
        } catch (error) {
          console.log('System UI setting failed:', error);
        }
      };
      setSystemUI();
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <UserProvider>
            <GamificationProvider>
              <LeaderboardProvider>
                <OnboardingProvider>
                  <UserTierProvider>
                    <UserSettingsProvider>
                      <DynamicStatusBar />
                      <RootLayoutNav />
                    </UserSettingsProvider>
                  </UserTierProvider>
                </OnboardingProvider>
              </LeaderboardProvider>
            </GamificationProvider>
          </UserProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
