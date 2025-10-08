import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
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

const LEADERBOARD = [
  { id: '1', rank: 1, name: 'TradeMaster', variant: 'winner' as const, xp: 12450 },
  { id: '2', rank: 2, name: 'BullRunner', variant: 'excited' as const, xp: 11200 },
  { id: '3', rank: 3, name: 'WolfStreet', variant: 'celebrating' as const, xp: 10800 },
  { id: '4', rank: 4, name: 'CryptoKing', variant: 'confident' as const, xp: 9650 },
  { id: '5', rank: 5, name: 'TechTrader', variant: 'thinking' as const, xp: 8920 },
];

const CURRENT_USER = {
  rank: 245,
  name: 'Wealthman Trader',
  variant: 'neutral' as const,
  xp: 2450,
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  
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
      >
        {/* Info Card */}
        <Card style={styles.infoCard} elevation="med">
          <Text variant="body" center style={styles.infoText}>
            Complete a lesson to join this week's leaderboard
          </Text>
          <Button 
            variant="primary" 
            size="large"
            onPress={() => router.push('/learning-topics')}
            fullWidth
            icon={<Icon name="trophy" size={20} color={theme.bg} />}
          >
            Start Learning
          </Button>
        </Card>

        {/* Top Performers */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Top Performers
          </Text>
          
          {LEADERBOARD.map((user) => {
            let badgeColor = theme.muted;
            if (user.rank === 1) badgeColor = theme.yellow;
            else if (user.rank === 2) badgeColor = '#C0C0C0';
            else if (user.rank === 3) badgeColor = '#CD7F32';
            
            return (
              <Card key={user.id} style={styles.leaderCard}>
                <View style={styles.leaderRow}>
                  <View style={[styles.rankBadge, { backgroundColor: badgeColor }]}>
                    <Text variant="body" weight="bold" color="#FFFFFF">
                      #{user.rank}
                    </Text>
                  </View>
                  
                  <FoxMascot variant={user.variant} size={44} />
                  
                  <Text variant="body" weight="semibold" style={styles.userName}>
                    {user.name}
                  </Text>
                  
                  <View style={styles.xpContainer}>
                    <Icon name="trophy" size={18} color={theme.yellow} />
                    <Text variant="small" weight="bold">
                      {user.xp.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>

        {/* Current User Position */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Your Position
          </Text>
          
          <Card style={{ ...styles.leaderCard, borderColor: theme.accent, borderWidth: 2 }}>
            <View style={styles.leaderRow}>
              <View style={[styles.rankBadge, { backgroundColor: theme.muted }]}>
                <Text variant="body" weight="bold" color="#FFFFFF">
                  #{CURRENT_USER.rank}
                </Text>
              </View>
              
              <FoxMascot variant={CURRENT_USER.variant} size={44} />
              
              <Text variant="body" weight="semibold" style={styles.userName}>
                {CURRENT_USER.name}
              </Text>
              
              <View style={styles.xpContainer}>
                <Icon name="trophy" size={18} color={theme.yellow} />
                <Text variant="small" weight="bold">
                  {CURRENT_USER.xp.toLocaleString()}
                </Text>
              </View>
            </View>
          </Card>
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
