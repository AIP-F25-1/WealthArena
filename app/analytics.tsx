import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserTier } from '@/contexts/UserTierContext';
import { useTheme, Text, Card, Button, Icon, tokens, FAB } from '@/src/design-system';

import CandlestickChart from '../components/CandlestickChart';

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { profile, isLoading } = useUserTier();
  
  // Show loading state while profile is being loaded
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen
          options={{
            title: 'Analytics',
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.lockedContainer}>
          <Text variant="h3" weight="semibold" center>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLocked = profile.tier === 'beginner' || profile.tier === null;

  if (isLocked) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen
          options={{
            title: 'Analytics',
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
          }}
        />
        <View style={styles.lockedContainer}>
          <View style={[styles.lockCircle, { backgroundColor: theme.surface }]}>
            <Icon name="shield" size={64} color={theme.muted} />
          </View>
          <Text variant="h2" weight="bold" center style={styles.lockedTitle}>
            Intermediate Feature
          </Text>
          <Text variant="body" center muted style={styles.lockedDescription}>
            Upgrade to Intermediate tier to access advanced analytics and performance reports
          </Text>
          <Button
            variant="primary"
            size="large"
            onPress={() => router.back()}
            icon={<Icon name="trophy" size={20} color={theme.bg} />}
          >
            Upgrade Tier
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Performance data for column chart
  const monthlyReturnsData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: [2.1, 4.3, -1.2, 3.8, 5.2, 2.9],
        color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green for positive returns
      },
    ],
  };

  // Asset allocation data for pie chart
  const assetAllocationData = [
    {
      name: 'Stocks',
      population: 60,
      color: theme.primary,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Bonds',
      population: 25,
      color: theme.accent,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Crypto',
      population: 10,
      color: theme.yellow,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: 'Cash',
      population: 5,
      color: theme.muted,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
  ];
  
  // Candlestick data for portfolio performance
  const portfolioCandleData: CandleData[] = [
    { timestamp: 'Week 1', open: 23500, high: 24200, low: 23300, close: 24000 },
    { timestamp: 'Week 2', open: 24000, high: 24800, low: 23800, close: 24500 },
    { timestamp: 'Week 3', open: 24500, high: 25200, low: 24200, close: 24800 },
    { timestamp: 'Week 4', open: 24800, high: 25500, low: 24600, close: 25200 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Analytics',
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
          <Icon name="market" size={32} color={theme.accent} />
          <Text variant="h2" weight="bold">Analytics Dashboard</Text>
          <Text variant="small" muted>Deep insights into your performance</Text>
        </Card>

        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Icon name="market" size={24} color={theme.primary} />
            <Text variant="h3" weight="bold" color={theme.primary}>+18.5%</Text>
            <Text variant="small" muted>YTD Return</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Icon name="check-shield" size={24} color={theme.accent} />
            <Text variant="h3" weight="bold">1.82</Text>
            <Text variant="small" muted>Sharpe Ratio</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Icon name="alert" size={24} color={theme.danger} />
            <Text variant="h3" weight="bold" color={theme.danger}>-12.3%</Text>
            <Text variant="small" muted>Max Drawdown</Text>
          </Card>
        </View>

        {/* Performance Chart */}
        <Card style={styles.chartCard}>
          <Text variant="h3" weight="semibold">Portfolio Performance</Text>
          <CandlestickChart 
            data={portfolioCandleData.map(candle => ({
              time: candle.timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close
            }))}
            chartType="daily"
          />
          <Text variant="xs" muted style={styles.chartNote}>
            Last 4 weeks portfolio value
          </Text>
        </Card>

        {/* Performance Attribution */}
        <Card style={styles.attributionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="portfolio" size={24} color={theme.primary} />
            <Text variant="h3" weight="semibold">Performance Attribution</Text>
          </View>

          {[
            { factor: 'Stock Selection', contribution: '+8.2%', color: theme.primary },
            { factor: 'Asset Allocation', contribution: '+5.1%', color: theme.accent },
            { factor: 'Market Timing', contribution: '+3.4%', color: theme.yellow },
            { factor: 'Sector Rotation', contribution: '+1.8%', color: theme.primary },
          ].map((item) => (
            <View key={item.factor} style={styles.attributionRow}>
              <View style={styles.attributionLeft}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text variant="small">{item.factor}</Text>
              </View>
              <Text variant="small" weight="semibold" color={item.color}>
                {item.contribution}
              </Text>
            </View>
          ))}
        </Card>

        {/* Risk Metrics */}
        <Card style={styles.riskCard}>
          <View style={styles.sectionHeader}>
            <Icon name="shield" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">Risk Metrics</Text>
          </View>

          <View style={styles.riskMetrics}>
            <View style={styles.riskMetric}>
              <Text variant="small" muted>Value at Risk (95%)</Text>
              <Text variant="body" weight="bold">$2,450</Text>
            </View>
            <View style={styles.riskMetric}>
              <Text variant="small" muted>Beta</Text>
              <Text variant="body" weight="bold">0.85</Text>
            </View>
            <View style={styles.riskMetric}>
              <Text variant="small" muted>Volatility</Text>
              <Text variant="body" weight="bold">15.2%</Text>
            </View>
          </View>
        </Card>

        {/* Sector Exposure */}
        <Card style={styles.sectorCard}>
          <View style={styles.sectionHeader}>
            <Icon name="portfolio" size={24} color={theme.primary} />
            <Text variant="h3" weight="semibold">Sector Exposure</Text>
          </View>

          {[
            { sector: 'Technology', percentage: 35, color: theme.accent },
            { sector: 'Healthcare', percentage: 25, color: theme.primary },
            { sector: 'Finance', percentage: 20, color: theme.yellow },
            { sector: 'Consumer', percentage: 15, color: theme.primary },
            { sector: 'Other', percentage: 5, color: theme.muted },
          ].map((item) => (
            <View key={item.sector} style={styles.sectorRow}>
              <View style={styles.sectorLeft}>
                <Text variant="small">{item.sector}</Text>
                <Text variant="xs" muted>{item.percentage}%</Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { backgroundColor: item.color, width: `${item.percentage}%` }
                  ]} 
                />
              </View>
            </View>
          ))}
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
    marginBottom: tokens.spacing.md,
  },
  lockedTitle: {
    marginBottom: tokens.spacing.xs,
  },
  lockedDescription: {
    maxWidth: 280,
    marginBottom: tokens.spacing.lg,
  },
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  metricCard: {
    width: '31%',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  chartCard: {
    gap: tokens.spacing.sm,
    alignItems: 'center',
  },
  chartNote: {
    marginTop: tokens.spacing.xs,
  },
  attributionCard: {
    gap: tokens.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  attributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  attributionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskCard: {
    gap: tokens.spacing.sm,
  },
  riskMetrics: {
    gap: tokens.spacing.sm,
  },
  riskMetric: {
    gap: 2,
  },
  sectorCard: {
    gap: tokens.spacing.sm,
  },
  sectorRow: {
    gap: tokens.spacing.xs,
  },
  sectorLeft: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
});
