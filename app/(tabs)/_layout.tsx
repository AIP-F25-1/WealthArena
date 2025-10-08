import { Tabs } from "expo-router";
import React from "react";
import { View, Platform } from "react-native";
import { tokens } from "@/src/design-system/tokens";
import { useTheme } from "@/src/design-system";
import { useUserSettings } from "@/contexts/UserSettingsContext";
import Svg, { Circle, Path, Rect, Line, Polyline } from "react-native-svg";
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Simple inline SVG icons to avoid hooks in tab config
const DashboardIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 48 48" fill="none">
    <Polyline points="6,32 14,22 22,26 30,14 42,20" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1="6" y1="38" x2="42" y2="38" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const PortfolioIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 48 48" fill="none">
    <Circle cx="24" cy="24" r="18" stroke={color} strokeWidth={2.5} fill="none" />
    <Path d="M24 24 L24 6 A18 18 0 0 1 38 15 Z" fill={color} opacity={0.3} />
  </Svg>
);

const TrophyIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 48 48" fill="none">
    <Path d="M12 10 h24 v6 a12 12 0 0 1-24 0 V10z" fill={color} opacity={0.8} />
    <Rect x="18" y="28" width="12" height="8" rx="2" fill={color} />
  </Svg>
);

const LeaderboardIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 48 48" fill="none">
    <Rect x="16" y="12" width="16" height="30" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
    <Rect x="4" y="24" width="10" height="18" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
    <Rect x="34" y="20" width="10" height="22" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
  </Svg>
);

const AccountIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 48 48" fill="none">
    <Path d="M10 16 C10 10, 14 6, 24 6 C34 6, 38 10, 38 16 L38 28 C38 32, 34 36, 24 36 C14 36, 10 32, 10 28 Z" 
      stroke={color} strokeWidth={2.5} strokeLinejoin="round" fill="none" />
    <Circle cx="18" cy="20" r="2" fill={color} />
    <Circle cx="30" cy="20" r="2" fill={color} />
  </Svg>
);

const NewsIcon = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 48 48" fill="none">
    <Rect x="8" y="8" width="32" height="24" rx="2" stroke={color} strokeWidth={2.5} fill="none" />
    <Line x1="8" y1="16" x2="40" y2="16" stroke={color} strokeWidth={2} />
    <Line x1="8" y1="20" x2="32" y2="20" stroke={color} strokeWidth={2} />
    <Line x1="8" y1="24" x2="28" y2="24" stroke={color} strokeWidth={2} />
    <Circle cx="36" cy="12" r="3" fill={color} />
  </Svg>
);

// Game Icon with special styling
const GameIcon = ({ color, backgroundColor }: { color: string; backgroundColor: string }) => (
  <View style={{
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 3,
    borderColor: backgroundColor,
    shadowColor: tokens.color.accentYellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  }}>
    <TrophyIcon color="#FFFFFF" />
  </View>
);

// Game Icon Component for Tab
const GameTabIcon = ({ color, backgroundColor }: { color: string; backgroundColor: string }) => (
  <GameIcon color={color} backgroundColor={backgroundColor} />
);

export default function TabLayout() {
  const { theme } = useTheme();
  const { settings } = useUserSettings();
  
  // Create the game tab icon with current theme using useMemo
  const GameTabIconRenderer = React.useMemo(
    () => (props: { color: string }) => (
      <GameTabIcon color={props.color} backgroundColor={theme.surface} />
    ),
    [theme.surface]
  );
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 105,
          paddingBottom: Platform.OS === 'ios' ? 28 : 6,
          paddingTop: Platform.OS === 'ios' ? 8 : 6,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: tokens.font.sizes.xs,
          fontWeight: '600',
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: DashboardIcon,
        }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{
          title: "Portfolio",
          tabBarIcon: PortfolioIcon,
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Game",
          tabBarIcon: ({ color }) => (
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: tokens.color.accentYellow,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -28,
              borderWidth: 3,
              borderColor: theme.surface,
              shadowColor: tokens.color.accentYellow,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 8,
            }}>
              <MaterialCommunityIcons name="microsoft-xbox-controller" size={28} color={theme.bg === '#071019' ? '#FFFFFF' : '#000000'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "News",
          tabBarIcon: NewsIcon,
          href: settings.showNews ? "/news" : null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Leaderboard",
          tabBarIcon: LeaderboardIcon,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: AccountIcon,
        }}
      />
    </Tabs>
  );
}
