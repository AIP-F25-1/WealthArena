import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';
import { openLearningResource } from '../utils/linking';

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
    cons: ['Can be risky in sideways markets', 'Requires quick decision making', 'May generate false signals'],
    resources: [
      { title: 'Momentum Trading Guide', url: 'https://www.investopedia.com/terms/m/momentum.asp' },
      { title: 'RSI Indicator Tutorial', url: 'https://www.investopedia.com/terms/r/rsi.asp' },
      { title: 'MACD Strategy Guide', url: 'https://www.investopedia.com/terms/m/macd.asp' }
    ]
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
    cons: ['Can be dangerous in trending markets', 'Requires precise timing', 'High risk of whipsaws'],
    resources: [
      { title: 'Mean Reversion Trading', url: 'https://www.investopedia.com/terms/m/meanreversion.asp' },
      { title: 'Bollinger Bands Guide', url: 'https://www.investopedia.com/terms/b/bollingerbands.asp' },
      { title: 'Statistical Arbitrage', url: 'https://www.investopedia.com/terms/s/statisticalarbitrage.asp' }
    ]
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
    cons: ['Requires patience', 'May underperform in short-term', 'Needs fundamental analysis skills'],
    resources: [
      { title: 'Value Investing Guide', url: 'https://www.investopedia.com/terms/v/valueinvesting.asp' },
      { title: 'P/E Ratio Analysis', url: 'https://www.investopedia.com/terms/p/price-earningsratio.asp' },
      { title: 'Warren Buffett Strategy', url: 'https://www.investopedia.com/articles/fundamental-analysis/11/warren-buffett-strategy.asp' }
    ]
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
    cons: ['Requires market timing', 'Overnight risk exposure', 'Needs trend identification skills'],
    resources: [
      { title: 'Swing Trading Guide', url: 'https://www.investopedia.com/terms/s/swingtrading.asp' },
      { title: 'Support and Resistance', url: 'https://www.investopedia.com/terms/s/support.asp' },
      { title: 'Fibonacci Trading', url: 'https://www.investopedia.com/terms/f/fibonacciretracement.asp' }
    ]
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
    cons: ['High false breakout risk', 'Requires quick execution', 'Can be volatile'],
    resources: [
      { title: 'Breakout Trading Guide', url: 'https://www.investopedia.com/terms/b/breakout.asp' },
      { title: 'Chart Pattern Recognition', url: 'https://www.investopedia.com/terms/c/chartpattern.asp' },
      { title: 'Volume Analysis', url: 'https://www.investopedia.com/terms/v/volume.asp' }
    ]
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
    cons: ['Very high risk', 'Requires constant attention', 'High transaction costs'],
    resources: [
      { title: 'Scalping Trading Guide', url: 'https://www.investopedia.com/terms/s/scalping.asp' },
      { title: 'Level 2 Market Data', url: 'https://www.investopedia.com/terms/l/level2.asp' },
      { title: 'Order Flow Analysis', url: 'https://www.investopedia.com/terms/o/orderflow.asp' }
    ]
  }
];

export default function StrategyDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams();
  
  const strategy = STRATEGIES.find(s => s.id === id);
  
  if (!strategy) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen
          options={{
            title: 'Strategy Not Found',
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.errorContainer}>
          <Text variant="h2" weight="bold">Strategy Not Found</Text>
          <Button variant="primary" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return theme.success;
      case 'Medium': return theme.warning;
      case 'Hard': return theme.danger;
      case 'Expert': return theme.error;
      default: return theme.muted;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return theme.success;
      case 'Medium': return theme.warning;
      case 'High': return theme.danger;
      case 'Very High': return theme.error;
      default: return theme.muted;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: strategy.name,
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Strategy Header */}
        <Card style={styles.headerCard}>
          <Text variant="h1" weight="bold" style={styles.strategyTitle}>
            {strategy.name}
          </Text>
          <Text variant="body" muted style={styles.strategyDescription}>
            {strategy.description}
          </Text>
          
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text variant="small" muted>Win Rate</Text>
              <Text variant="h3" weight="bold" color={theme.success}>
                {strategy.winRate}%
              </Text>
            </View>
            <View style={styles.metric}>
              <Text variant="small" muted>Profitability</Text>
              <Text variant="h3" weight="bold" color={theme.primary}>
                {strategy.profitability}%
              </Text>
            </View>
          </View>
        </Card>

        {/* Strategy Details */}
        <Card style={styles.detailsCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Strategy Overview
          </Text>
          <Text variant="body" style={styles.overviewText}>
            {strategy.fullDescription}
          </Text>
        </Card>

        {/* Key Metrics */}
        <Card style={styles.metricsCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Key Metrics
          </Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text variant="small" muted>Difficulty</Text>
              <Badge variant="secondary" size="small">
                <Text variant="small" color={getDifficultyColor(strategy.difficulty)}>
                  {strategy.difficulty}
                </Text>
              </Badge>
            </View>
            <View style={styles.metricItem}>
              <Text variant="small" muted>Risk Level</Text>
              <Badge variant="secondary" size="small">
                <Text variant="small" color={getRiskColor(strategy.riskLevel)}>
                  {strategy.riskLevel}
                </Text>
              </Badge>
            </View>
            <View style={styles.metricItem}>
              <Text variant="small" muted>Time Frame</Text>
              <Text variant="small" weight="semibold">{strategy.timeFrame}</Text>
            </View>
          </View>
        </Card>

        {/* How to Apply */}
        <Card style={styles.applyCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            How to Apply
          </Text>
          <Text variant="body" style={styles.applyText}>
            {strategy.howToApply}
          </Text>
        </Card>

        {/* Technical Indicators */}
        <Card style={styles.indicatorsCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Technical Indicators
          </Text>
          <View style={styles.indicatorsList}>
          {strategy.indicators.map((indicator) => (
            <Badge key={indicator} variant="primary" size="small">
              {indicator}
            </Badge>
          ))}
          </View>
        </Card>

        {/* Pros and Cons */}
        <View style={styles.prosConsContainer}>
          <Card style={styles.prosCard}>
            <Text variant="h3" weight="semibold" color={theme.success} style={styles.sectionTitle}>
              Advantages
            </Text>
            {strategy.pros.map((pro) => (
              <View key={pro} style={styles.listItem}>
                <Icon name="check" size={16} color={theme.success} />
                <Text variant="small" style={styles.listText}>{pro}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.consCard}>
            <Text variant="h3" weight="semibold" color={theme.danger} style={styles.sectionTitle}>
              Disadvantages
            </Text>
            {strategy.cons.map((con) => (
              <View key={con} style={styles.listItem}>
                <Icon name="close" size={16} color={theme.danger} />
                <Text variant="small" style={styles.listText}>{con}</Text>
              </View>
            ))}
          </Card>
        </View>

        {/* Learning Resources */}
        <Card style={styles.resourcesCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Learning Resources
          </Text>
          {strategy.resources.map((resource) => (
            <Pressable
              key={resource.title}
              style={styles.resourceItem}
              onPress={() => openLearningResource(resource.url)}
            >
              <Icon name="external-link" size={20} color={theme.primary} />
              <Text variant="small" color={theme.primary} weight="semibold">
                {resource.title}
              </Text>
            </Pressable>
          ))}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button 
            variant="primary" 
            size="large"
            icon={<Icon name="play" size={20} color={theme.bg} />}
            onPress={() => router.push('/trade-simulator')}
          >
            Practice This Strategy
          </Button>
          <Button 
            variant="secondary" 
            size="large"
            icon={<Icon name="bookmark" size={20} color={theme.primary} />}
            onPress={() => {
              // Bookmark functionality - to be implemented
              console.log('Bookmark strategy:', strategy.name);
            }}
          >
            Save Strategy
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.lg,
  },
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  strategyTitle: {
    textAlign: 'center',
  },
  strategyDescription: {
    textAlign: 'center',
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xl,
    marginTop: tokens.spacing.sm,
  },
  metric: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  detailsCard: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.sm,
  },
  overviewText: {
    lineHeight: 22,
  },
  metricsCard: {
    gap: tokens.spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  metricItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    minWidth: 80,
  },
  applyCard: {
    gap: tokens.spacing.sm,
  },
  applyText: {
    lineHeight: 22,
    whiteSpace: 'pre-line',
  },
  indicatorsCard: {
    gap: tokens.spacing.sm,
  },
  indicatorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  prosConsContainer: {
    gap: tokens.spacing.md,
  },
  prosCard: {
    gap: tokens.spacing.sm,
  },
  consCard: {
    gap: tokens.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  listText: {
    flex: 1,
    lineHeight: 18,
  },
  resourcesCard: {
    gap: tokens.spacing.sm,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  actionsContainer: {
    gap: tokens.spacing.sm,
  },
});
