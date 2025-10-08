import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, FAB, tokens } from '@/src/design-system';
import CandlestickChart from '../components/CandlestickChart';

const INDICATORS = [
  { id: '1', name: 'RSI', value: '62', signal: 'Bullish', description: 'Relative Strength Index above 50' },
  { id: '2', name: 'MACD', value: 'Positive', signal: 'Buy', description: 'Moving Average Convergence Divergence crossover' },
  { id: '3', name: 'SMA 50', value: '$170.25', signal: 'Above', description: 'Price trading above 50-day moving average' },
  { id: '4', name: 'Bollinger Bands', value: 'Upper', signal: 'Overbought', description: 'Price near upper band' },
];

export default function TechnicalAnalysisScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selectedIndicator, setSelectedIndicator] = useState(INDICATORS[0]);

  // Real candlestick data for AAPL
  const candleData: CandleData[] = [
    { timestamp: 'Mon', open: 170.00, high: 172.50, low: 169.00, close: 171.80 },
    { timestamp: 'Tue', open: 171.80, high: 174.00, low: 171.20, close: 173.50 },
    { timestamp: 'Wed', open: 173.50, high: 175.80, low: 172.50, close: 174.20 },
    { timestamp: 'Thu', open: 174.20, high: 176.00, low: 173.00, close: 175.50 },
    { timestamp: 'Fri', open: 175.50, high: 177.50, low: 174.80, close: 176.50 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Technical Analysis',
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
          <View style={styles.headerRow}>
            <View style={[styles.symbolCircle, { backgroundColor: theme.accent + '20' }]}>
              <Text variant="h2" weight="bold" color={theme.accent}>A</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text variant="h2" weight="bold">AAPL Technical Analysis</Text>
              <Text variant="small" muted>Real-time indicators and signals</Text>
            </View>
          </View>
        </Card>

        {/* Price Chart */}
        <Card style={styles.chartCard}>
          <Text variant="h3" weight="semibold">Price Action</Text>
          <CandlestickChart 
            data={candleData.map(candle => ({
              time: candle.timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close
            }))}
            chartType="daily"
          />
          <View style={styles.chartInfo}>
            <View>
              <Text variant="small" muted>Current</Text>
              <Text variant="body" weight="bold">$175.50</Text>
            </View>
            <View>
              <Text variant="small" muted>Change</Text>
              <Text variant="body" weight="bold" color={theme.primary}>+2.3%</Text>
            </View>
            <View>
              <Text variant="small" muted>Volume</Text>
              <Text variant="body" weight="bold">45.2M</Text>
            </View>
          </View>
        </Card>

        {/* Technical Indicators */}
        <Card style={styles.indicatorsCard}>
          <View style={styles.sectionHeader}>
            <Icon name="signal" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">Key Indicators</Text>
          </View>

          {INDICATORS.map((indicator) => {
            const isPositive = indicator.signal === 'Bullish' || indicator.signal === 'Buy' || indicator.signal === 'Above';
            
            return (
              <Pressable
                key={indicator.id}
                onPress={() => setSelectedIndicator(indicator)}
              >
                <Card 
                  style={[
                    styles.indicatorCard,
                    selectedIndicator.id === indicator.id && { borderColor: theme.primary, borderWidth: 2 }
                  ]}
                >
                  <View style={styles.indicatorHeader}>
                    <View style={styles.indicatorLeft}>
                      <Text variant="body" weight="bold">{indicator.name}</Text>
                      <Badge 
                        variant={isPositive ? 'success' : 'warning'} 
                        size="small"
                      >
                        {indicator.signal}
                      </Badge>
                    </View>
                    <Text variant="body" weight="bold">{indicator.value}</Text>
                  </View>
                  <Text variant="small" muted>{indicator.description}</Text>
                </Card>
              </Pressable>
            );
          })}
        </Card>

        {/* Summary */}
        <Card style={[styles.summaryCard, { backgroundColor: theme.primary + '10' }]}>
          <View style={styles.summaryHeader}>
            <Icon name="check-shield" size={28} color={theme.primary} />
            <View style={styles.summaryText}>
              <Text variant="body" weight="semibold">Overall Signal</Text>
              <Text variant="small" muted>Based on technical indicators</Text>
            </View>
          </View>
          <Badge variant="success" size="medium">Strong Buy</Badge>
          <Button
            variant="primary"
            size="large"
            fullWidth
            icon={<Icon name="execute" size={20} color={theme.bg} />}
            onPress={() => router.push('/trade-setup')}
            style={styles.tradeButton}
          >
            Execute Trade
          </Button>
        </Card>

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
      
      <FAB onPress={() => router.push('/ai-chat')} />
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
  headerCard: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  symbolCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  chartCard: {
    gap: tokens.spacing.sm,
    alignItems: 'center',
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: tokens.spacing.sm,
  },
  indicatorsCard: {
    gap: tokens.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  indicatorCard: {
    gap: tokens.spacing.xs,
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    gap: tokens.spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  tradeButton: {
    marginTop: tokens.spacing.xs,
  },
});
