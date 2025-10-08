import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserTier } from '@/contexts/UserTierContext';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';

const STRATEGIES = [
  { 
    id: '1', 
    name: 'Momentum Trading', 
    description: 'Follow market trends using technical indicators', 
    difficulty: 'Medium',
    winRate: 68,
    profitability: 15.2,
    riskLevel: 'Medium',
    timeFrame: 'Short-term',
    indicators: ['RSI', 'MACD', 'Moving Averages'],
    fullDescription: 'A strategy that follows market trends by buying stocks that are moving up and selling stocks that are moving down. Uses technical indicators to identify momentum.',
    howToApply: '1. Identify trending stocks using moving averages\n2. Use RSI to confirm momentum\n3. Enter positions on breakouts\n4. Set stop-losses at support levels',
    pros: ['High profit potential in trending markets', 'Clear entry and exit signals', 'Works well in volatile markets'],
    cons: ['Can be risky in sideways markets', 'Requires quick decision making', 'May generate false signals']
  },
  { 
    id: '2', 
    name: 'Mean Reversion', 
    description: 'Buy low, sell high based on statistical analysis', 
    difficulty: 'Hard',
    winRate: 72,
    profitability: 12.8,
    riskLevel: 'High',
    timeFrame: 'Medium-term',
    indicators: ['Bollinger Bands', 'RSI', 'Stochastic'],
    fullDescription: 'A contrarian strategy that assumes prices will revert to their mean after extreme movements. Best used in ranging markets.',
    howToApply: '1. Identify oversold/overbought conditions\n2. Use Bollinger Bands for entry signals\n3. Wait for confirmation from RSI\n4. Set tight stop-losses',
    pros: ['High win rate in ranging markets', 'Clear statistical edge', 'Works well with mean-reverting assets'],
    cons: ['Can be dangerous in trending markets', 'Requires precise timing', 'High risk of whipsaws']
  },
  { 
    id: '3', 
    name: 'Value Investing', 
    description: 'Long-term fundamentals-based approach', 
    difficulty: 'Easy',
    winRate: 85,
    profitability: 18.5,
    riskLevel: 'Low',
    timeFrame: 'Long-term',
    indicators: ['P/E Ratio', 'PEG Ratio', 'Book Value'],
    fullDescription: 'A fundamental analysis strategy that focuses on buying undervalued stocks and holding them for long periods.',
    howToApply: '1. Analyze company fundamentals\n2. Look for undervalued stocks\n3. Check financial health and growth prospects\n4. Hold for 1-5 years',
    pros: ['High long-term returns', 'Lower risk', 'Less time-intensive'],
    cons: ['Requires patience', 'May underperform in short-term', 'Needs fundamental analysis skills']
  },
  { 
    id: '4', 
    name: 'Swing Trading', 
    description: 'Capture price swings over days to weeks', 
    difficulty: 'Medium',
    winRate: 65,
    profitability: 14.3,
    riskLevel: 'Medium',
    timeFrame: 'Medium-term',
    indicators: ['Support/Resistance', 'Fibonacci', 'Volume'],
    fullDescription: 'A strategy that aims to capture price movements over several days to weeks, holding positions for longer than day trading.',
    howToApply: '1. Identify key support and resistance levels\n2. Use Fibonacci retracements\n3. Confirm with volume analysis\n4. Hold positions for 2-10 days',
    pros: ['Less time-intensive than day trading', 'Good profit potential', 'Flexible time commitment'],
    cons: ['Requires market timing', 'Overnight risk exposure', 'Needs trend identification skills']
  },
  { 
    id: '5', 
    name: 'Breakout Trading', 
    description: 'Trade price breakouts from consolidation', 
    difficulty: 'Hard',
    winRate: 58,
    profitability: 16.7,
    riskLevel: 'High',
    timeFrame: 'Short-term',
    indicators: ['Volume', 'Support/Resistance', 'Chart Patterns'],
    fullDescription: 'A strategy that focuses on trading breakouts from consolidation patterns, aiming to catch the beginning of new trends.',
    howToApply: '1. Identify consolidation patterns\n2. Wait for volume confirmation\n3. Enter on breakout with momentum\n4. Use tight stop-losses',
    pros: ['High profit potential', 'Clear entry signals', 'Works in trending markets'],
    cons: ['High false breakout risk', 'Requires quick execution', 'Can be volatile']
  },
  { 
    id: '6', 
    name: 'Scalping', 
    description: 'Quick profits from small price movements', 
    difficulty: 'Expert',
    winRate: 45,
    profitability: 8.9,
    riskLevel: 'Very High',
    timeFrame: 'Very Short-term',
    indicators: ['Level 2 Data', 'Order Flow', 'Tick Charts'],
    fullDescription: 'A high-frequency trading strategy that aims to profit from small price movements by making many trades throughout the day.',
    howToApply: '1. Use 1-minute charts\n2. Focus on liquid stocks\n3. Enter and exit quickly\n4. Minimize transaction costs',
    pros: ['Quick profits', 'Less market exposure', 'High frequency opportunities'],
    cons: ['Very high risk', 'Requires constant attention', 'High transaction costs']
  }
];

export default function StrategyLabScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { profile } = useUserTier();
  const isLocked = profile.tier === 'beginner';

  if (isLocked) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen
          options={{
            title: 'Strategy Lab',
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.lockedContainer}>
          <View style={[styles.lockCircle, { backgroundColor: theme.surface }]}>
            <Icon name="shield" size={64} color={theme.muted} />
          </View>
          <Text variant="h2" weight="bold" center>Intermediate Feature</Text>
          <Text variant="body" center muted style={styles.lockedDescription}>
            Complete beginner challenges to unlock Strategy Lab and build custom trading strategies
          </Text>
          <Button variant="primary" size="large" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Strategy Lab',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={styles.headerCard} elevation="med">
          <Icon name="lab" size={32} color={theme.accent} />
          <Text variant="h2" weight="bold">Strategy Lab</Text>
          <Text variant="small" muted center>
            Build and test custom trading strategies
          </Text>
        </Card>

        {/* Strategy Templates */}
        <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
          Strategy Templates
        </Text>

        {STRATEGIES.map((strategy) => {
          const getDifficultyVariant = () => {
            if (strategy.difficulty === 'Easy') return 'success' as const;
            if (strategy.difficulty === 'Medium') return 'warning' as const;
            return 'danger' as const;
          };
          const difficultyVariant = getDifficultyVariant();

          return (
            <Pressable 
              key={strategy.id}
              onPress={() => router.push(`/strategy-detail?id=${strategy.id}`)}
            >
              <Card style={styles.strategyCard}>
                <View style={styles.strategyHeader}>
                  <View style={styles.strategyTitleRow}>
                    <View style={styles.strategyLeft}>
                      <Icon name="lab" size={24} color={theme.accent} />
                      <View style={styles.strategyInfo}>
                        <Text variant="body" weight="semibold">{strategy.name}</Text>
                        <Text variant="small" muted>{strategy.description}</Text>
                      </View>
                    </View>
                    <View style={styles.strategyBadges}>
                      <Badge variant={difficultyVariant} size="small">
                        {strategy.difficulty}
                      </Badge>
                    </View>
                  </View>
                  
                  <View style={styles.strategyMetrics}>
                    <View style={styles.metric}>
                      <Text variant="xs" muted>Win Rate</Text>
                      <Text variant="small" weight="semibold" color={theme.success}>
                        {strategy.winRate}%
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text variant="xs" muted>Profitability</Text>
                      <Text variant="small" weight="semibold" color={theme.primary}>
                        {strategy.profitability}%
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text variant="xs" muted>Risk</Text>
                      <Text variant="small" weight="semibold" color={theme.danger}>
                        {strategy.riskLevel}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.strategyActions}>
                  <Button 
                    variant="secondary" 
                    size="small"
                    onPress={() => router.push(`/strategy-detail?id=${strategy.id}`)}
                    style={styles.actionButton}
                  >
                    Learn More
                  </Button>
                  <Button 
                    variant="primary" 
                    size="small"
                    onPress={() => router.push('/trade-simulator')}
                    style={styles.actionButton}
                  >
                    Practice
                  </Button>
                </View>
              </Card>
            </Pressable>
          );
        })}

        {/* Create New Strategy */}
        <Card style={styles.createCard}>
          <View style={styles.createContent}>
            <Icon name="plus" size={32} color={theme.primary} />
            <View style={styles.createText}>
              <Text variant="h3" weight="semibold">Create Custom Strategy</Text>
              <Text variant="small" muted>Build your own trading strategy from scratch</Text>
            </View>
          </View>
          <Button variant="primary" size="medium">
            Create Strategy
          </Button>
        </Card>

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
    gap: tokens.spacing.lg,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  lockCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedDescription: {
    maxWidth: 280,
    marginBottom: tokens.spacing.lg,
  },
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.xs,
  },
  strategyCard: {
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  strategyHeader: {
    gap: tokens.spacing.md,
  },
  strategyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  strategyLeft: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  strategyInfo: {
    flex: 1,
    gap: 4,
  },
  strategyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: tokens.radius.sm,
  },
  metric: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  strategyBadges: {
    alignItems: 'flex-end',
  },
  strategyActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'flex-start',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionButton: {
    flex: 1,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.lg,
  },
  createContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    flex: 1,
  },
  createText: {
    gap: tokens.spacing.xs,
    flex: 1,
  },
});
