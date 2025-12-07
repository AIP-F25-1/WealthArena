import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator } from 'react-native';
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
import { useUser } from '@/contexts/UserContext';
import { useLeaderboard } from '@/contexts/LeaderboardContext';
import { getActiveSessions, getGameHistory, discardGameSession, apiService } from '@/services/apiService';

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
  const { user } = useUser();
  const { globalLeaderboard } = useLeaderboard();

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [weeklyChallenge, setWeeklyChallenge] = useState<any>(null);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);

  const userLevel = user?.current_level || 1; // Default to level 1 for new users
  const currentXP = user?.xp_points || 0; // Default to 0 XP for new users
  const nextLevelXP = calculateNextLevelXP(userLevel); // Calculate based on actual level
  const xpProgress = nextLevelXP > 0 ? (currentXP / nextLevelXP) * 100 : 0;

  // Calculate XP required for next level based on current level
  function calculateNextLevelXP(level: number): number {
    // XP progression: Level 1->2: 100 XP, Level 2->3: 250 XP, etc.
    const levelThresholds = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, 3850, 4500];
    return levelThresholds[level] || (level * 500); // Fallback formula for higher levels
  }

  // Load active sessions and game history
  useEffect(() => {
    const loadGameData = async () => {
      if (!user?.user_id) return;
      
      setIsLoadingSessions(true);
      try {
        const [sessions, history] = await Promise.all([
          getActiveSessions(),
          getGameHistory(5)
        ]);
        setActiveSessions(sessions.data || []);
        setGameHistory(history.data || []);
      } catch (error) {
        console.error('Failed to load game data:', error);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadGameData();
  }, [user?.user_id]);

  // Load achievements
  useEffect(() => {
    const loadAchievements = async () => {
      if (!user?.user_id) return;

      setIsLoadingAchievements(true);
      try {
        const response = await apiService.getAchievements();
        if (response.success && response.data) {
          // Filter for recently unlocked achievements and map to UI format
          const recentAchievements = (response.data as any[])
            .filter((ach: any) => ach.unlocked_at || ach.isUnlocked)
            .sort((a: any, b: any) => {
              const dateA = new Date(a.unlocked_at || a.unlockedAt || 0).getTime();
              const dateB = new Date(b.unlocked_at || b.unlockedAt || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, 5)
            .map((ach: any) => {
              // Map backend achievement to UI format
              const iconMap: Record<string, string> = {
                'perfect_trade': 'target',
                'risk_master': 'shield',
                'chart_expert': 'trending-up',
                'streak_master': 'lightning-bolt',
                'portfolio_builder': 'layers',
              };
              
              return {
                id: ach.achievement_id || ach.id,
                title: ach.achievement_name || ach.name || 'Achievement',
                xp: ach.xp_reward || ach.xpReward || 50,
                description: ach.description || 'Great achievement!',
                icon: iconMap[ach.achievement_type || ach.type] || 'trophy',
                color: '#4A90E2',
                gradient: ['#4A90E2', '#357ABD'],
              };
            });
          
          setAchievements(recentAchievements);
        }
      } catch (error) {
        console.error('Failed to load achievements:', error);
      } finally {
        setIsLoadingAchievements(false);
      }
    };

    loadAchievements();
  }, [user?.user_id]);

  // Load weekly challenge
  useEffect(() => {
    const loadWeeklyChallenge = async () => {
      if (!user?.user_id) return;

      setIsLoadingChallenge(true);
      try {
        const response = await apiService.getQuests();
        if (response.success && response.data) {
          // Filter for weekly challenges
          const weeklyQuests = (response.data as any[]).filter(
            (q: any) => q.quest_type === 'weekly' || q.type === 'weekly' || q.frequency === 'weekly'
          );
          
          if (weeklyQuests.length > 0) {
            const challenge = weeklyQuests[0];
            setWeeklyChallenge({
              title: challenge.quest_name || challenge.name || 'Weekly Challenge',
              description: challenge.description || 'Complete this week\'s challenge',
              current: challenge.current_progress || challenge.currentProgress || 0,
              target: challenge.target_progress || challenge.targetProgress || 10,
              reward: challenge.reward || '500 XP + Rare Badge',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load weekly challenge:', error);
      } finally {
        setIsLoadingChallenge(false);
      }
    };

    loadWeeklyChallenge();
  }, [user?.user_id]);

  const handleDiscardSession = async (sessionId: string) => {
    try {
      await discardGameSession(sessionId);
      // Reload sessions
      const sessions = await getActiveSessions();
      setActiveSessions(sessions.data || []);
    } catch (error) {
      console.error('Failed to discard session:', error);
    }
  };

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

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Icon name="play" size={24} color={theme.primary} />
                <Text variant="h3" weight="semibold">Active Sessions</Text>
              </View>
              <Badge variant="primary" size="small">{activeSessions.length}</Badge>
            </View>
            {isLoadingSessions ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              activeSessions.map((session) => (
                <Card key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionRow}>
                    <View style={styles.sessionInfo}>
                      <Text variant="body" weight="semibold">{session.game_type || 'Trading Game'}</Text>
                      <Text variant="small" muted>
                        Balance: ${session.current_balance?.toLocaleString() || '0'}
                      </Text>
                      <Text variant="xs" muted>
                        Last saved: {new Date(session.updated_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.sessionActions}>
                      <Button
                        variant="primary"
                        size="small"
                        onPress={() => router.push(`/game-play?sessionId=${session.id}`)}
                        icon={<Icon name="play" size={16} color={theme.bg} />}
                      >
                        Resume
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onPress={() => handleDiscardSession(session.id)}
                        icon={<Icon name="trash" size={16} color={theme.danger} />}
                      >
                        Discard
                      </Button>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </Card>
        )}

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

        {/* Beginner-Friendly Game Mode */}
        <Card style={styles.gameModeCard} elevation="med">
          <View style={styles.gameModeHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.success + '20' }]}>
              <Ionicons name="school" size={32} color={theme.success} />
            </View>
            <View style={styles.gameModeText}>
              <Text variant="h3" weight="semibold">Beginner Trading Game</Text>
              <Text variant="small" muted>Learn with simple charts & helpful tips</Text>
            </View>
          </View>
          <Text variant="small" style={styles.gameModeDescription}>
            Perfect for beginners! Trade multiple instruments with step-by-step guidance, simplified charts, and educational tooltips.
          </Text>
          <Button 
            variant="primary" 
            size="large"
            onPress={() => router.push('/game-setup')}
            fullWidth
            icon={<Ionicons name="school-outline" size={20} color="#FFFFFF" />}
          >
            Start Learning
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

        {/* Portfolio Builder Game */}
        <Card style={styles.gameModeCard} elevation="med">
          <View style={styles.gameModeHeader}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="briefcase" size={32} color={theme.accent} />
            </View>
            <View style={styles.gameModeText}>
              <Text variant="h3" weight="semibold">Portfolio Builder</Text>
              <Text variant="small" muted>Create & manage multiple portfolios</Text>
            </View>
          </View>
          <Text variant="small" style={styles.gameModeDescription}>
            Build diversified portfolios with multiple instruments. Learn asset allocation and portfolio management strategies.
          </Text>
          <Button 
            variant="secondary" 
            size="large"
            onPress={() => router.push('/portfolio-builder')}
            fullWidth
            icon={<Ionicons name="briefcase-outline" size={20} color={theme.primary} />}
          >
            Build Portfolio
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

          {(globalLeaderboard.slice(0, 3).map((player) => (
            <LeaderboardCard 
              key={player.userId} 
              entry={{
                id: player.userId.toString(),
                rank: player.rank,
                name: player.displayName || player.username,
                variant: 'confident' as const,
                xp: player.xpPoints
              }}
              onPress={() => router.push('/(tabs)/chat')}
            />
          )) || getTopPerformers(3).map((player) => (
            <LeaderboardCard 
              key={player.id} 
              entry={player}
              onPress={() => router.push('/(tabs)/chat')}
            />
          )))}
        </Card>

        {/* Recent Achievements */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="trophy" size={24} color={theme.yellow} />
              <Text variant="h3" weight="semibold">Recent Achievements</Text>
            </View>
          </View>

          {isLoadingAchievements ? (
            <View style={styles.loadingContainer}>
              <Text variant="small" muted>Loading achievements...</Text>
            </View>
          ) : achievements.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementScroll}
            >
              {achievements.map((achievement) => (
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
          ) : (
            <View style={styles.loadingContainer}>
              <Text variant="small" muted>No achievements yet. Start playing to unlock achievements!</Text>
            </View>
          )}
        </Card>

        {/* Recent Games */}
        {gameHistory.length > 0 && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Icon name="trophy" size={24} color={theme.yellow} />
                <Text variant="h3" weight="semibold">Recent Games</Text>
              </View>
            </View>
            {gameHistory.map((game) => {
              const profitLoss = (game.final_balance || 0) - (game.initial_balance || 100000);
              const profitPercent = game.initial_balance ? ((profitLoss / game.initial_balance) * 100) : 0;
              const isProfit = profitLoss >= 0;
              
              return (
                <Card key={game.id} style={styles.gameCard}>
                  <View style={styles.gameRow}>
                    <View style={styles.gameInfo}>
                      <Text variant="body" weight="semibold">{game.game_type || 'Trading Game'}</Text>
                      <Text variant="small" muted>
                        Completed: {new Date(game.completed_at).toLocaleDateString()}
                      </Text>
                      <Text variant="small" weight="semibold">
                        Final Balance: ${game.final_balance?.toLocaleString() || '0'}
                      </Text>
                    </View>
                    <View style={styles.gameStats}>
                      <Badge variant={isProfit ? 'success' : 'danger'} size="small">
                        {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
                      </Badge>
                      {game.xp_earned && (
                        <Text variant="xs" muted>+{game.xp_earned} XP</Text>
                      )}
                      {game.coins_earned && (
                        <Text variant="xs" muted>+{game.coins_earned} Coins</Text>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </Card>
        )}

        {/* Challenge of the Week */}
        {isLoadingChallenge ? (
          <Card style={styles.card} elevation="med">
            <View style={styles.loadingContainer}>
              <Text variant="small" muted>Loading weekly challenge...</Text>
            </View>
          </Card>
        ) : weeklyChallenge ? (
          <Card style={styles.card} elevation="med">
            <View style={styles.challengeContent}>
              <View style={[styles.iconCircle, { backgroundColor: theme.accent + '20' }]}>
                <Ionicons name="flame" size={28} color={theme.accent} />
              </View>
              <View style={styles.challengeText}>
                <Text variant="h3" weight="semibold">{weeklyChallenge.title}</Text>
                <Text variant="small" muted>{weeklyChallenge.description}</Text>
                <View style={styles.progressRow}>
                  <View style={[styles.miniProgressBar, { backgroundColor: theme.border }]}>
                    <View 
                      style={[
                        styles.miniProgressFill, 
                        { 
                          backgroundColor: theme.accent, 
                          width: `${Math.min(100, (weeklyChallenge.current / weeklyChallenge.target) * 100)}%` 
                        }
                      ]} 
                    />
                  </View>
                  <Text variant="xs" muted>{weeklyChallenge.current}/{weeklyChallenge.target}</Text>
                </View>
              </View>
            </View>
            <Text variant="xs" muted style={styles.challengeReward}>
              Reward: {weeklyChallenge.reward}
            </Text>
          </Card>
        ) : null}

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
  sessionCard: {
    marginBottom: tokens.spacing.sm,
    padding: tokens.spacing.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  sessionInfo: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  sessionActions: {
    gap: tokens.spacing.xs,
  },
  gameCard: {
    marginBottom: tokens.spacing.sm,
    padding: tokens.spacing.sm,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
  },
  gameInfo: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  gameStats: {
    alignItems: 'flex-end',
    gap: tokens.spacing.xs,
  },
});
