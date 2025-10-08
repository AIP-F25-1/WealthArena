import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Icon, 
  Badge,
  FoxMascot,
  FAB,
  tokens 
} from '@/src/design-system';
import LeaderboardCard from '../../components/LeaderboardCard';
import { getTopPerformers } from '../../data/leaderboardData';

const { width } = Dimensions.get('window');

const getBadgeColor = (badge: string, theme: any) => {
  switch (badge) {
    case 'gold': return theme.yellow;
    case 'silver': return '#C0C0C0';
    case 'bronze': return '#CD7F32';
    default: return theme.muted;
  }
};

export default function GameScreen() {
  const router = useRouter();
  const { theme, mode } = useTheme();

  const userLevel = 12;
  const currentXP = 2450;
  const nextLevelXP = 3000;
  const xpProgress = (currentXP / nextLevelXP) * 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section with Gradient - Elevated Design */}
        <Card style={styles.heroCard} elevation="high" noBorder>
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroText}>
                <Text variant="h1" weight="bold" color="#FFFFFF">
                  Game Arena
                </Text>
                <Text variant="body" color="#FFFFFF" style={styles.heroSubtitle}>
                  Level up your trading skills through play
                </Text>
              </View>
              <FoxMascot variant="winner" size={100} />
            </View>
          </LinearGradient>
        </Card>

        {/* Player Stats Card */}
        <Card style={styles.statsCard} elevation="med">
          <View style={styles.statsHeader}>
            <View>
              <Text variant="h2" weight="bold">Level {userLevel}</Text>
              <Text variant="small" muted>Trading Champion</Text>
            </View>
            <View style={[styles.xpBadge, { backgroundColor: theme.yellow }]}>
              <Icon name="trophy" size={20} color="#FFFFFF" />
              <Text variant="small" weight="bold" color="#FFFFFF">{currentXP} XP</Text>
            </View>
          </View>
          
          {/* XP Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { backgroundColor: theme.primary, width: `${xpProgress}%` }
                ]} 
              />
            </View>
            <Text variant="xs" muted>{currentXP} / {nextLevelXP} XP</Text>
          </View>
        </Card>

        {/* VS AI Competition */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="execute" size={24} color={theme.accent} />
              <Text variant="h3" weight="semibold">You VS AI Duel</Text>
            </View>
          </View>
          <Text variant="small" muted>Compete against the AI Agent in a fast market scenario.</Text>
          <Button 
            variant="primary" 
            size="large"
            onPress={() => router.push('/vs-ai-start')}
            fullWidth
            icon={<Icon name="robot" size={18} color={theme.bg} />}
          >
            Play Against AI
          </Button>
        </Card>

        {/* Main Game Mode - Historical Fast-Forward */}
        <Card style={styles.gameModeCard} elevation="med">
          <View style={styles.gameModeHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="play-forward" size={32} color={theme.primary} />
            </View>
            <View style={styles.gameModeText}>
              <Text variant="h3" weight="semibold">Historical Fast-Forward</Text>
              <Text variant="small" muted>Practice with real market data</Text>
            </View>
          </View>
          <Text variant="small" style={styles.gameModeDescription}>
            Travel back in time and trade through historical market events. Test your skills with real data in accelerated mode.
          </Text>
          <Button 
            variant="primary" 
            size="large"
            onPress={() => router.push('/trade-simulator')}
            fullWidth
            icon={<MaterialCommunityIcons name="gamepad-variant-outline" size={20} color={mode === 'dark' ? '#000000' : '#FFFFFF'} />}
          >
            Play Episode
          </Button>
        </Card>

        {/* Leaderboard Preview */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="leaderboard" size={24} color={theme.yellow} />
              <Text variant="h3" weight="semibold">Top Performers</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/chat')}>
              <Text variant="small" color={theme.primary} weight="semibold">View All</Text>
            </Pressable>
          </View>

          {getTopPerformers(3).map((player) => (
            <LeaderboardCard 
              key={player.id} 
              entry={player}
              onPress={() => router.push('/(tabs)/chat')}
            />
          ))}
        </Card>

        {/* Recent Achievements */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="trophy" size={24} color={theme.yellow} />
              <Text variant="h3" weight="semibold">Recent Achievements</Text>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementScroll}
          >
            {[
              { 
                id: 'perfect-trade',
                title: 'Perfect Trade', 
                xp: 50, 
                description: 'Executed a trade with perfect timing',
                icon: 'target',
                color: '#00FF6A',
                gradient: ['#00FF6A', '#00CC55']
              },
              { 
                id: 'risk-master',
                title: 'Risk Master', 
                xp: 75, 
                description: 'Managed risk like a pro',
                icon: 'shield',
                color: '#FF6B35',
                gradient: ['#FF6B35', '#FF8C42']
              },
              { 
                id: 'chart-expert',
                title: 'Chart Expert', 
                xp: 100, 
                description: 'Mastered technical analysis',
                icon: 'trending-up',
                color: '#4A90E2',
                gradient: ['#4A90E2', '#357ABD']
              },
              { 
                id: 'streak-master',
                title: 'Streak Master', 
                xp: 150, 
                description: 'Maintained a 10-day winning streak',
                icon: 'lightning-bolt',
                color: '#FFD700',
                gradient: ['#FFD700', '#FFA500']
              },
              { 
                id: 'portfolio-builder',
                title: 'Portfolio Builder', 
                xp: 200, 
                description: 'Built a diversified portfolio',
                icon: 'layers',
                color: '#9B59B6',
                gradient: ['#9B59B6', '#8E44AD']
              },
            ].map((achievement) => (
              <Card key={`achievement-${achievement.id}`} style={styles.achievementCard} elevation="low">
                <LinearGradient
                  colors={achievement.gradient as [string, string]}
                  style={styles.achievementBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons 
                    name={achievement.icon as any} 
                    size={32} 
                    color="#FFFFFF" 
                  />
                </LinearGradient>
                <Text variant="small" weight="semibold" center numberOfLines={1}>
                  {achievement.title}
                </Text>
                <Text variant="xs" muted center numberOfLines={2}>
                  {achievement.description}
                </Text>
                <Badge variant="warning" size="small">+{achievement.xp} XP</Badge>
              </Card>
            ))}
          </ScrollView>
        </Card>

        {/* Challenge of the Week */}
        <Card style={styles.card} elevation="med">
          <View style={styles.challengeContent}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="flame" size={28} color={theme.accent} />
            </View>
            <View style={styles.challengeText}>
              <Text variant="h3" weight="semibold">Weekly Challenge</Text>
              <Text variant="small" muted>Execute 10 profitable trades</Text>
              <View style={styles.progressRow}>
                <View style={[styles.miniProgressBar, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.miniProgressFill, 
                      { backgroundColor: theme.accent, width: '60%' }
                    ]} 
                  />
                </View>
                <Text variant="xs" muted>6/10</Text>
              </View>
            </View>
          </View>
          <Text variant="xs" muted style={styles.challengeReward}>
            Reward: 500 XP + Rare Badge
          </Text>
        </Card>

        {/* Bottom Spacing */}
        <View style={{ height: 80 }} />
      </ScrollView>
      
      <FAB onPress={() => router.push('/ai-chat')} />
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
  heroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  heroSubtitle: {
    opacity: 0.9,
  },
  statsCard: {
    gap: tokens.spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
  },
  progressBarContainer: {
    gap: tokens.spacing.xs,
  },
  progressBarBg: {
    height: 12,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  gameModeCard: {
    gap: tokens.spacing.md,
  },
  gameModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameModeText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  gameModeDescription: {
    lineHeight: 20,
  },
  card: {
    gap: tokens.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementScroll: {
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.md,
  },
  achievementCard: {
    width: 140,
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
  },
  achievementBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  challengeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  challengeText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  miniProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  challengeReward: {
    marginTop: tokens.spacing.xs,
  },
});
