/**
 * User vs AI Battle - Game Over Screen
 * Displays comprehensive match results and winner
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme, Text, Card, Button, Badge, tokens, HumanAvatar, RobotAvatar } from '@/src/design-system';

interface GameResults {
  symbol: string;
  userPnL: number;
  aiPnL: number;
  userBalance: number;
  aiBalance: number;
  userTrades: number;
  aiTrades: number;
  userWon: boolean;
  isTie: boolean;
}

function calculateResults(params: Record<string, string | undefined>): GameResults {
  const symbol = params.symbol || 'BTC/USD';
  const userPnL = parseFloat(params.userPnL || '0');
  const aiPnL = parseFloat(params.aiPnL || '0');
  const userBalance = parseFloat(params.userBalance || '100000');
  const aiBalance = parseFloat(params.aiBalance || '100000');
  const userTrades = parseInt(params.userTrades || '0');
  const aiTrades = parseInt(params.aiTrades || '0');
  const userWon = userPnL > aiPnL;
  const isTie = Math.abs(userPnL - aiPnL) < 0.01;

  return {
    symbol,
    userPnL,
    aiPnL,
    userBalance,
    aiBalance,
    userTrades,
    aiTrades,
    userWon,
    isTie
  };
}

// Custom Trophy SVG
function TrophyIcon({ color, size = 64 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15C15.866 15 19 11.866 19 8V5H5V8C5 11.866 8.13401 15 12 15Z"
        stroke={color}
        strokeWidth="2"
        fill={color}
        opacity="0.2"
      />
      <Path
        d="M19 5H21C21.5523 5 22 5.44772 22 6V8C22 9.10457 21.1046 10 20 10H19"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M5 5H3C2.44772 5 2 5.44772 2 6V8C2 9.10457 2.89543 10 4 10H5"
        stroke={color}
        strokeWidth="2"
      />
      <Path d="M12 15V19M12 19H15M12 19H9" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M9 22H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// Custom Handshake SVG (for tie)
function HandshakeIcon({ color, size = 64 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12L9 15L6 12L9 9M12 12L15 15L18 12L15 9M12 12L9 9M12 12L15 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export default function VsAIGameOver() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    symbol?: string;
    userPnL?: string;
    aiPnL?: string;
    userBalance?: string;
    aiBalance?: string;
    userTrades?: string;
    aiTrades?: string;
  }>();

  const results = calculateResults(params);
  const {
    symbol,
    userPnL,
    aiPnL,
    userBalance,
    aiBalance,
    userTrades,
    aiTrades,
    userWon,
    isTie
  } = results;

  const getWinnerText = () => {
    if (isTie) return "It's a Tie!";
    if (userWon) return 'You Win!';
    return 'AI Wins';
  };

  const getWinnerColorValue = (): string => {
    if (isTie) return '#F59E0B'; // Amber
    if (userWon) return '#10B981'; // Green
    return '#EF4444'; // Red
  };
  const winnerColor = getWinnerColorValue();

  const getPerformanceBadge = () => {
    if (userPnL > 5000) return { text: 'Master Trader', variant: 'success' as const };
    if (userPnL > 1000) return { text: 'Excellent', variant: 'primary' as const };
    if (userPnL > 0) return { text: 'Profitable', variant: 'primary' as const };
    if (userPnL > -1000) return { text: 'Keep Learning', variant: 'warning' as const };
    return { text: 'Try Again', variant: 'danger' as const };
  };

  const performanceBadge = getPerformanceBadge();
  const userReturnPercent = ((userPnL / 100000) * 100).toFixed(2);
  const aiReturnPercent = ((aiPnL / 100000) * 100).toFixed(2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Match Results',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerLeft: () => null,
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Winner Banner */}
        <Card style={StyleSheet.flatten([styles.winnerBanner, { backgroundColor: winnerColor + '15', borderColor: winnerColor, borderWidth: 2 }])}>
          <View style={[styles.iconContainer, { backgroundColor: winnerColor + '20' }]}>
            {isTie ? (
              <HandshakeIcon color={winnerColor} size={72} />
            ) : (
              <TrophyIcon color={winnerColor} size={72} />
            )}
          </View>
          <Text variant="h1" weight="bold" center color={winnerColor}>
            {getWinnerText()}
          </Text>
          <Badge variant={performanceBadge.variant} size="large">
            {performanceBadge.text}
          </Badge>
        </Card>

        {/* Match Info */}
        <Card style={styles.matchInfo}>
          <View style={styles.matchInfoRow}>
            <Text variant="small" muted>Trading Symbol</Text>
            <Badge variant="primary" size="medium">{symbol}</Badge>
          </View>
        </Card>

        {/* Comparison Stats */}
        <View style={styles.comparison}>
          {/* User Column */}
          <Card style={StyleSheet.flatten([
            styles.competitorCard, 
            userWon && { borderColor: '#10B981', borderWidth: 3 }
          ])}>
            <View style={styles.competitorHeader}>
              <HumanAvatar size={40} />
              <Text variant="h3" weight="bold">You</Text>
            </View>

            <View style={styles.statBox}>
              <Text variant="small" muted>Final P&L</Text>
              <Text 
                variant="h2" 
                weight="bold"
                color={userPnL >= 0 ? '#10B981' : '#EF4444'}
              >
                {userPnL >= 0 ? '+' : ''}${userPnL.toFixed(2)}
              </Text>
              <Text variant="xs" muted>
                ({userPnL >= 0 ? '+' : ''}{userReturnPercent}%)
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="xs" muted>Final Balance</Text>
                <Text variant="body" weight="semibold">
                  ${userBalance.toFixed(0)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="xs" muted>Trades Made</Text>
                <Text variant="body" weight="semibold" color={theme.primary}>
                  {userTrades}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="xs" muted>Avg Trade</Text>
                <Text variant="body" weight="semibold">
                  ${userTrades > 0 ? (userPnL / userTrades).toFixed(2) : '0.00'}
                </Text>
              </View>
            </View>
          </Card>

          {/* AI Column */}
          <Card style={StyleSheet.flatten([
            styles.competitorCard, 
            !userWon && !isTie && { borderColor: '#EF4444', borderWidth: 3 }
          ])}>
            <View style={styles.competitorHeader}>
              <RobotAvatar size={40} />
              <Text variant="h3" weight="bold">AI</Text>
            </View>

            <View style={styles.statBox}>
              <Text variant="small" muted>Final P&L</Text>
              <Text 
                variant="h2" 
                weight="bold"
                color={aiPnL >= 0 ? '#10B981' : '#EF4444'}
              >
                {aiPnL >= 0 ? '+' : ''}${aiPnL.toFixed(2)}
              </Text>
              <Text variant="xs" muted>
                ({aiPnL >= 0 ? '+' : ''}{aiReturnPercent}%)
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="xs" muted>Final Balance</Text>
                <Text variant="body" weight="semibold">
                  ${aiBalance.toFixed(0)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="xs" muted>Trades Made</Text>
                <Text variant="body" weight="semibold" color={theme.accent}>
                  {aiTrades}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="xs" muted>Avg Trade</Text>
                <Text variant="body" weight="semibold">
                  ${aiTrades > 0 ? (aiPnL / aiTrades).toFixed(2) : '0.00'}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Performance Insights */}
        <Card style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Ionicons name="bulb-outline" size={24} color="#F59E0B" />
            <Text variant="body" weight="semibold">Match Insights</Text>
          </View>
          <View style={styles.insightsList}>
            {userPnL > aiPnL ? (
              <>
                <View style={styles.insightItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text variant="small" style={{ flex: 1 }}>
                    You outperformed the AI by ${Math.abs(userPnL - aiPnL).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.insightItem}>
                  <Ionicons name="trending-up" size={20} color={theme.primary} />
                  <Text variant="small" style={{ flex: 1 }}>
                    Your strategy generated a {userReturnPercent}% return
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.insightItem}>
                  <Ionicons name="information-circle" size={20} color={theme.accent} />
                  <Text variant="small" style={{ flex: 1 }}>
                    AI outperformed by ${Math.abs(userPnL - aiPnL).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.insightItem}>
                  <Ionicons name="school-outline" size={20} color="#F59E0B" />
                  <Text variant="small" style={{ flex: 1 }}>
                    Review trade timing and risk management strategies
                  </Text>
                </View>
              </>
            )}
            {userTrades > aiTrades && (
              <View style={styles.insightItem}>
                <Ionicons name="swap-horizontal" size={20} color={theme.accent} />
                <Text variant="small" style={{ flex: 1 }}>
                  You traded more actively ({userTrades} vs {aiTrades} trades)
                </Text>
              </View>
            )}
            {aiTrades > userTrades && (
              <View style={styles.insightItem}>
                <Ionicons name="swap-horizontal" size={20} color={theme.accent} />
                <Text variant="small" style={{ flex: 1 }}>
                  AI traded more actively ({aiTrades} vs {userTrades} trades)
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="large"
            fullWidth
            onPress={() => router.replace('/vs-ai-start')}
            icon={<Ionicons name="play" size={20} color={theme.bg} />}
          >
            Play Again
          </Button>
          <Button
            variant="secondary"
            size="large"
            fullWidth
            onPress={() => router.push('/(tabs)/game')}
            icon={<Ionicons name="home" size={20} color={theme.text} />}
          >
            Back to Game
          </Button>
        </View>

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  winnerBanner: {
    alignItems: 'center',
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchInfo: {
    gap: tokens.spacing.sm,
  },
  matchInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparison: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  competitorCard: {
    flex: 1,
    gap: tokens.spacing.md,
  },
  competitorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  statBox: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  statsGrid: {
    gap: tokens.spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  insightsCard: {
    gap: tokens.spacing.md,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  insightsList: {
    gap: tokens.spacing.sm,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  actions: {
    gap: tokens.spacing.sm,
  },
});
