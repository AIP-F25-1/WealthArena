import React from 'react';
import { View, StyleSheet, ScrollView, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Icon,
  FAB,
  FoxMascot,
  tokens 
} from '@/src/design-system';
import { useUser } from '@/contexts/UserContext';
import { useLeaderboard } from '@/contexts/LeaderboardContext';
import UserAvatar from '@/components/UserAvatar';

// This will be replaced with real user data in the component
const getCurrentUser = (userData?: any) => ({
  rank: 245, // This would come from leaderboard API
  name: userData?.full_name || userData?.displayName || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Trader',
  variant: 'neutral' as const,
  xp: userData?.xp_points || 2450,
});

export default function LeaderboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, userRank: userContextRank } = useUser();
  const { globalLeaderboard, userRank: leaderboardRank, isLoading, refreshLeaderboard } = useLeaderboard();
  
  const [refreshing, setRefreshing] = React.useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLeaderboard();
    setRefreshing(false);
  };
  
  // Use leaderboard rank if available, otherwise fall back to UserContext rank, then user.rank
  const currentUser = leaderboardRank || {
    rank: userContextRank || user?.rank || 0,
    xp: user?.xp_points || 0,
    winRate: 0,
    totalTrades: 0,
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Icon name="leaderboard" size={28} color={theme.yellow} />
          <Text variant="h3" weight="bold">Leaderboard</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Rank Card */}
        {(leaderboardRank || userContextRank || user?.rank) && (
          <Card style={[styles.infoCard, { borderColor: theme.primary, borderWidth: 1 }]} elevation="med">
            <View style={styles.userRankHeader}>
              <UserAvatar user={user} size={56} />
              <View style={styles.userRankInfo}>
                <Text variant="h2" weight="bold">#{leaderboardRank?.rank || userContextRank || user?.rank || 'Unranked'}</Text>
                <Text variant="body" muted>{leaderboardRank?.displayName || user?.displayName || 'You'}</Text>
              </View>
            </View>
            <View style={styles.userStats}>
              <View style={styles.statItem}>
                <Icon name="trophy" size={20} color={theme.yellow} />
                <Text variant="body" weight="semibold">{leaderboardRank?.xpPoints || user?.xp_points || 0} XP</Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="trending-up" size={20} color={theme.primary} />
                <Text variant="body" weight="semibold">{leaderboardRank?.winRate || user?.win_rate || 0}% Win Rate</Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="execute" size={20} color={theme.accent} />
                <Text variant="body" weight="semibold">{leaderboardRank?.totalTrades || user?.total_trades || 0} Trades</Text>
              </View>
            </View>
            <Button 
              variant="secondary" 
              size="medium"
              onPress={onRefresh}
              disabled={isLoading}
              fullWidth
              icon={<Icon name="refresh" size={18} color={theme.primary} />}
            >
              {isLoading ? 'Refreshing...' : 'Refresh Leaderboard'}
            </Button>
          </Card>
        )}

        {/* Top Performers */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Top Performers
          </Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: tokens.spacing.lg }} />
          ) : (
            (globalLeaderboard.length > 0 ? globalLeaderboard : []).map((entry, index) => {
              const isCurrentUser = entry.userId === user?.user_id;
              let badgeColor = theme.muted;
              if (entry.rank === 1) badgeColor = theme.yellow;
              else if (entry.rank === 2) badgeColor = '#C0C0C0';
              else if (entry.rank === 3) badgeColor = '#CD7F32';
              
              return (
                <Card 
                  key={entry.userId} 
                  style={[
                    styles.leaderCard,
                    isCurrentUser && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + '10' }
                  ]}
                >
                  <View style={styles.leaderRow}>
                    <View style={[styles.rankBadge, { backgroundColor: badgeColor }]}>
                      <Text variant="body" weight="bold" color="#FFFFFF">
                        #{entry.rank}
                      </Text>
                    </View>
                    
                    <FoxMascot variant={entry.rank <= 3 ? 'winner' as const : 'confident' as const} size={44} />
                    
                    <Text variant="body" weight="semibold" style={styles.userName}>
                      {entry.displayName || entry.username}
                    </Text>
                    
                    <View style={styles.xpContainer}>
                      <Icon name="trophy" size={18} color={theme.yellow} />
                      <Text variant="small" weight="bold">
                        {entry.xpPoints.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>


        {/* Bottom Spacing */}
        <View style={{ height: Platform.OS === 'android' ? 170 : 80 }} />
      </ScrollView>

      <FAB onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  infoCard: {
    gap: tokens.spacing.md,
    alignItems: 'center',
  },
  infoText: {
    lineHeight: 22,
  },
  userRankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  userRankInfo: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  statItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.xs,
  },
  leaderCard: {
    padding: tokens.spacing.sm,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    flex: 1,
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
});
