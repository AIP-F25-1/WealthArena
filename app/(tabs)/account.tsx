import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
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
  FoxMascot,
  tokens 
} from '@/src/design-system';
import { useUserSettings } from '../../contexts/UserSettingsContext';

export default function AccountScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const { settings, toggleNews } = useUserSettings();
  
  const isDarkMode = mode === 'dark';
  
  const handleThemeToggle = () => {
    setMode(isDarkMode ? 'light' : 'dark');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <Card style={styles.profileCard} elevation="med">
          <View style={styles.profileHeader}>
            <FoxMascot variant="neutral" size={80} />
            <View style={styles.profileInfo}>
              <Text variant="h2" weight="bold">Wealthman Trader</Text>
              <Text variant="small" muted>trader@wealtharena.com</Text>
              <Badge variant="primary" size="small" style={styles.levelBadge}>
                Level 12
              </Badge>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="trophy" size={20} color={theme.yellow} />
              <Text variant="small" muted>2,450 XP</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="check-shield" size={20} color={theme.primary} />
              <Text variant="small" muted>15 Badges</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="leaderboard" size={20} color={theme.accent} />
              <Text variant="small" muted>Rank #245</Text>
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
              <Text variant="h3" weight="bold">7</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Ionicons name="logo-bitcoin" size={32} color="#FFC800" />
              <Text variant="small" muted>Coins</Text>
              <Text variant="h3" weight="bold">1,250</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Ionicons name="star" size={32} color="#7C3AED" />
              <Text variant="small" muted>XP Earned</Text>
              <Text variant="h3" weight="bold">2,450</Text>
            </Card>
            
            <Card style={styles.statCard}>
              <Icon name="check-shield" size={32} color={theme.primary} />
              <Text variant="small" muted>Completed</Text>
              <Text variant="h3" weight="bold">28</Text>
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
          onPress={() => router.replace('/splash')}
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
});
