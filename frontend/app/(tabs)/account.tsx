import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Icon, 
  Badge,
  tokens 
} from '@/src/design-system';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { useUser } from '@/contexts/UserContext';
import UserAvatar from '@/components/UserAvatar';

export default function AccountScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const { settings, toggleNews } = useUserSettings();
  const { user, logout: logoutUser, refreshUser } = useUser();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  const isDarkMode = mode === 'dark';

  // Refresh profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.user_id) {
        return;
      }
      try {
        setIsRefreshing(true);
        setProfileError(null);
        await refreshUser();
      } catch (error: any) {
        console.error('Failed to refresh profile:', error);
        setProfileError(error.message || 'Failed to refresh profile');
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchProfile();
  }, [user?.user_id]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setProfileError(null);
      await refreshUser();
    } catch (error: any) {
      console.error('Failed to refresh profile:', error);
      setProfileError(error.message || 'Failed to refresh profile');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleThemeToggle = () => {
    setMode(isDarkMode ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/splash');
  };

  // Get user display name
  const displayName = user?.full_name || user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Trader';
  const userEmail = user?.email || 'trader@wealtharena.com';
  const userLevel = user?.current_level || 1;
  const userXP = user?.xp_points || 0;
  const userStreak = user?.current_streak || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Error Banner */}
        {profileError && (
          <Card style={[styles.errorBanner, { backgroundColor: theme.danger + '20', borderColor: theme.danger }]}>
            <View style={styles.errorContent}>
              <Icon name="alert-circle" size={20} color={theme.danger} />
              <Text variant="small" color={theme.danger} style={styles.errorText}>
                {profileError}
              </Text>
              <Pressable onPress={handleRefresh}>
                <Text variant="small" color={theme.primary} weight="semibold">
                  Retry
                </Text>
              </Pressable>
            </View>
          </Card>
        )}
        {/* Profile Header */}
        <Card style={styles.profileCard} elevation="med">
          <View style={styles.profileHeader}>
            <Pressable onPress={() => router.push('/user-profile')}>
              <UserAvatar user={user} size={80} />
            </Pressable>
            <View style={styles.profileInfo}>
              <Text variant="h2" weight="bold">{displayName}</Text>
              <Text variant="small" muted>{userEmail}</Text>
              {user?.bio ? (
                <Text variant="small" muted numberOfLines={2} style={styles.bioText}>
                  {user.bio}
                </Text>
              ) : (
                <Pressable onPress={() => router.push('/user-profile')}>
                  <Text variant="small" color={theme.primary}>
                    No bio yet. Tap to add one.
                  </Text>
                </Pressable>
              )}
              <Badge variant="primary" size="small" style={styles.levelBadge}>
                Level {userLevel}
              </Badge>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="trophy" size={20} color={theme.yellow} />
              <Text variant="small" muted>{userXP.toLocaleString()} XP</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="check-shield" size={20} color={theme.primary} />
              <Text variant="small" muted>{user?.total_trades || 0} Trades</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="leaderboard" size={20} color={theme.accent} />
              <Text variant="small" muted>{userStreak} Day Streak</Text>
            </View>
          </View>
        </Card>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Settings
          </Text>

          {/* Dark Mode Toggle */}
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Icon name="settings" size={24} color={theme.text} />
                <View style={styles.settingInfo}>
                  <Text variant="body" weight="semibold">Dark Mode</Text>
                  <Text variant="small" muted>Toggle theme appearance</Text>
                </View>
              </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleThemeToggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
            </View>
          </Card>

          <Pressable onPress={() => router.push('/user-profile')}>
            <Card style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Icon name="agent" size={24} color={theme.text} />
                  <View style={styles.settingInfo}>
                    <Text variant="body" weight="semibold">Edit Profile</Text>
                    <Text variant="small" muted>Update your information</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.muted} />
              </View>
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push('/notifications')}>
            <Card style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Icon name="bell" size={24} color={theme.text} />
                  <View style={styles.settingInfo}>
                    <Text variant="body" weight="semibold">Notifications</Text>
                    <Text variant="small" muted>Manage alerts</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.muted} />
              </View>
            </Card>
          </Pressable>

          {/* News Toggle */}
          <Card style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Icon name="newspaper" size={24} color={theme.text} />
                <View style={styles.settingInfo}>
                  <Text variant="body" weight="semibold">Market News</Text>
                  <Text variant="small" muted>
                    {settings.showNews ? 'News tab enabled' : 'News tab hidden'}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.showNews}
                onValueChange={toggleNews}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={settings.showNews ? '#FFFFFF' : theme.muted}
              />
            </View>
          </Card>
        </View>

        {/* Statistics Section */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Your Statistics
          </Text>
          
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Icon name="trophy" size={32} color={theme.yellow} />
              <Text variant="small" muted>Day Streak</Text>
              <Text variant="h3" weight="bold">{userStreak}</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Ionicons name="logo-bitcoin" size={32} color="#FFC800" />
              <Text variant="small" muted>Coins</Text>
              <Text variant="h3" weight="bold">{user?.total_coins?.toLocaleString() || '0'}</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Ionicons name="star" size={32} color="#7C3AED" />
              <Text variant="small" muted>XP Earned</Text>
              <Text variant="h3" weight="bold">{userXP.toLocaleString()}</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Icon name="check-shield" size={32} color={theme.primary} />
              <Text variant="small" muted>Completed</Text>
              <Text variant="h3" weight="bold">{user?.total_trades || 0}</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Icon name="target" size={32} color={user?.win_rate && user.win_rate >= 70 ? theme.success : user?.win_rate && user.win_rate >= 50 ? theme.warning : theme.danger} />
              <Text variant="small" muted>Win Rate</Text>
              <Text variant="h3" weight="bold">
                {user?.win_rate ? `${user.win_rate.toFixed(1)}%` : '--'}
              </Text>
            </Card>
          </View>
        </View>

        {/* Admin Portal Access */}
        <Card style={{ ...styles.adminCard, borderColor: theme.yellow }}>
          <Pressable 
            style={styles.adminButton}
            onPress={() => router.push('/admin-portal')}
          >
            <Icon name="shield" size={24} color={theme.yellow} />
            <View style={styles.adminInfo}>
              <Text variant="body" weight="semibold">Admin Portal</Text>
              <Text variant="small" muted>Partner access</Text>
            </View>
          </Pressable>
        </Card>

        {/* Logout Button */}
        <Button 
          variant="danger" 
          size="large"
          onPress={handleLogout}
          fullWidth
          icon={<Ionicons name="log-out-outline" size={20} color={theme.bg} />}
        >
          Log Out
        </Button>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  profileCard: {
    gap: tokens.spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  profileInfo: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    marginTop: tokens.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.xs,
  },
  settingCard: {
    padding: tokens.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  coinIcon: {
    width: 32,
    height: 32,
  },
  adminCard: {
    borderWidth: 2,
    padding: 0,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  adminInfo: {
    flex: 1,
    gap: 2,
  },
  errorBanner: {
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  errorText: {
    flex: 1,
  },
  bioText: {
    marginTop: tokens.spacing.xs,
  },
});
