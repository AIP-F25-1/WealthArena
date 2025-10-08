import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, FAB, tokens } from '@/src/design-system';
import CandlestickChart from '../components/CandlestickChart';
import AISignalCard from '../components/AISignalCard';
import { AITradingSignal } from '../types/ai-signal';

type AssetType = 'stocks' | 'currencies' | 'crypto' | 'commodities' | 'etfs';

interface SignalData {
  symbol: string;
  name: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  target: number;
  change: number;
  candleData: CandleData[];
}

const SIGNALS: Record<AssetType, SignalData[]> = {
  stocks: [
    { 
      symbol: 'AAPL', name: 'Apple Inc.', signal: 'BUY', confidence: 87, price: 175.50, target: 185.00, change: +2.3,
      candleData: [
        { timestamp: '10:00', open: 173, high: 175, low: 172, close: 174 },
        { timestamp: '11:00', open: 174, high: 176, low: 173.5, close: 175.5 },
        { timestamp: '12:00', open: 175.5, high: 177, low: 175, close: 176 },
      ]
    },
    { 
      symbol: 'TSLA', name: 'Tesla Inc.', signal: 'SELL', confidence: 72, price: 227.20, target: 210.00, change: -1.2,
      candleData: [
        { timestamp: '10:00', open: 230, high: 232, low: 227, close: 228 },
        { timestamp: '11:00', open: 228, high: 229, low: 225, close: 226 },
        { timestamp: '12:00', open: 226, high: 228, low: 224, close: 227 },
      ]
    },
    { 
      symbol: 'GOOGL', name: 'Alphabet Inc.', signal: 'BUY', confidence: 91, price: 138.40, target: 148.00, change: +1.8,
      candleData: [
        { timestamp: '10:00', open: 136, high: 138, low: 135.5, close: 137.5 },
        { timestamp: '11:00', open: 137.5, high: 139, low: 137, close: 138.4 },
        { timestamp: '12:00', open: 138.4, high: 140, low: 138, close: 139 },
      ]
    },
    { 
      symbol: 'MSFT', name: 'Microsoft Corp.', signal: 'HOLD', confidence: 65, price: 384.50, target: 390.00, change: +0.4,
      candleData: [
        { timestamp: '10:00', open: 383, high: 385, low: 382, close: 384 },
        { timestamp: '11:00', open: 384, high: 386, low: 383.5, close: 384.5 },
        { timestamp: '12:00', open: 384.5, high: 386, low: 384, close: 385 },
      ]
    },
  ],
  currencies: [
    { 
      symbol: 'EUR/USD', name: 'Euro/US Dollar', signal: 'BUY', confidence: 78, price: 1.0854, target: 1.0950, change: +0.5,
      candleData: [
        { timestamp: '10:00', open: 1.0840, high: 1.0860, low: 1.0835, close: 1.0850 },
        { timestamp: '11:00', open: 1.0850, high: 1.0865, low: 1.0845, close: 1.0854 },
      ]
    },
    { 
      symbol: 'GBP/USD', name: 'Pound/US Dollar', signal: 'SELL', confidence: 82, price: 1.2643, target: 1.2500, change: -0.3,
      candleData: [
        { timestamp: '10:00', open: 1.2660, high: 1.2670, low: 1.2640, close: 1.2650 },
        { timestamp: '11:00', open: 1.2650, high: 1.2655, low: 1.2635, close: 1.2643 },
      ]
    },
  ],
  crypto: [
    { 
      symbol: 'BTC', name: 'Bitcoin', signal: 'BUY', confidence: 89, price: 43250, target: 46000, change: +3.2,
      candleData: [
        { timestamp: '10:00', open: 42800, high: 43200, low: 42600, close: 43100 },
        { timestamp: '11:00', open: 43100, high: 43500, low: 43000, close: 43250 },
      ]
    },
    { 
      symbol: 'ETH', name: 'Ethereum', signal: 'BUY', confidence: 85, price: 2280, target: 2450, change: +2.1,
      candleData: [
        { timestamp: '10:00', open: 2250, high: 2270, low: 2240, close: 2265 },
        { timestamp: '11:00', open: 2265, high: 2290, low: 2260, close: 2280 },
      ]
    },
  ],
  commodities: [
    {
      symbol: 'XAUUSD', name: 'Gold', signal: 'BUY', confidence: 76, price: 2345.2, target: 2380.0, change: +0.7,
      candleData: [
        { timestamp: '10:00', open: 2338, high: 2350, low: 2332, close: 2342 },
        { timestamp: '11:00', open: 2342, high: 2352, low: 2340, close: 2345.2 },
      ]
    },
    {
      symbol: 'XTIUSD', name: 'Crude Oil', signal: 'HOLD', confidence: 58, price: 82.15, target: 83.00, change: -0.2,
      candleData: [
        { timestamp: '10:00', open: 82.6, high: 82.9, low: 81.9, close: 82.1 },
        { timestamp: '11:00', open: 82.1, high: 82.3, low: 81.8, close: 82.15 },
      ]
    },
  ],
  etfs: [
    {
      symbol: 'SPY', name: 'SPDR S&P 500 ETF', signal: 'BUY', confidence: 81, price: 518.42, target: 530.00, change: +0.9,
      candleData: [
        { timestamp: '10:00', open: 512, high: 516, low: 511, close: 515 },
        { timestamp: '11:00', open: 515, high: 519, low: 514, close: 518.42 },
      ]
    },
    {
      symbol: 'QQQ', name: 'Invesco QQQ Trust', signal: 'SELL', confidence: 67, price: 440.35, target: 430.00, change: -0.6,
      candleData: [
        { timestamp: '10:00', open: 443, high: 444, low: 439, close: 441 },
        { timestamp: '11:00', open: 441, high: 442, low: 439.8, close: 440.35 },
      ]
    },
  ],
};

// Sample AI Signal for demonstration
const SAMPLE_AI_SIGNAL: AITradingSignal = {
  symbol: "AAPL",
  prediction_date: "2024-10-04T19:30:00Z",
  asset_type: "stock",
  
  trading_signal: {
    signal: "BUY",
    confidence: 0.8700,
    model_version: "v2.3.1"
  },
  
  entry_strategy: {
    price: 175.50,
    price_range: [174.80, 176.20],
    timing: "immediate",
    reasoning: "Strong momentum with favorable setup"
  },
  
  take_profit_levels: [
    {
      level: 1,
      price: 180.00,
      percent_gain: 2.56,
      close_percent: 50,
      probability: 0.75,
      reasoning: "First resistance level"
    },
    {
      level: 2,
      price: 185.00,
      percent_gain: 5.41,
      close_percent: 30,
      probability: 0.55,
      reasoning: "Major resistance zone"
    },
    {
      level: 3,
      price: 190.00,
      percent_gain: 8.26,
      close_percent: 20,
      probability: 0.35,
      reasoning: "Extended target"
    }
  ],
  
  stop_loss: {
    price: 171.00,
    percent_loss: -2.56,
    type: "trailing",
    trail_amount: 2.50,
    reasoning: "Below recent support"
  },
  
  risk_management: {
    risk_reward_ratio: 3.20,
    max_risk_per_share: 4.50,
    max_reward_per_share: 14.50,
    win_probability: 0.68,
    expected_value: 7.82
  },
  
  position_sizing: {
    recommended_percent: 5.0,
    dollar_amount: 6142.00,
    shares: 35,
    max_loss: 157.50,
    method: "Kelly Criterion",
    kelly_fraction: 0.053,
    volatility_adjusted: true
  },
  
  model_metadata: {
    model_type: "Multi-Agent RL",
    agents_used: ["TradingAgent", "RiskAgent", "PortfolioAgent"],
    training_date: "2024-10-01",
    backtest_sharpe: 1.95,
    feature_importance: {
      RSI: 0.18,
      MACD: 0.15,
      Momentum_10: 0.12,
      Volume_Ratio: 0.10,
      Price_Action: 0.09
    }
  },
  
  indicators_state: {
    rsi: { value: 58.3, status: "neutral" },
    macd: { value: 0.85, status: "bullish" },
    atr: { value: 2.45, status: "medium_volatility" },
    volume: { value: 1.15, status: "above_average" },
    trend: { direction: "up", strength: "strong" }
  }
};

export default function TradeSignalsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('stocks');
  const [viewMode, setViewMode] = useState<'ai' | 'legacy'>('ai');

  const getSignalColor = (signal: string) => {
    if (signal === 'BUY') return theme.primary;
    if (signal === 'SELL') return theme.danger;
    return theme.muted;
  };

  const getSignalVariant = (signal: string): 'success' | 'danger' | 'secondary' => {
    if (signal === 'BUY') return 'success';
    if (signal === 'SELL') return 'danger';
    return 'secondary';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Trade Signals',
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
          <Icon name="signal" size={32} color={theme.accent} />
          <Text variant="h2" weight="bold">AI-Powered Signals</Text>
          <Text variant="small" muted center>
            Real-time trading recommendations powered by machine learning
          </Text>
          
          {/* View Mode Toggle */}
          <View style={styles.viewModeToggle}>
            <Pressable
              onPress={() => setViewMode('ai')}
              style={[
                styles.toggleButton,
                viewMode === 'ai' && { backgroundColor: theme.primary }
              ]}
            >
              <Icon 
                name="agent" 
                size={18} 
                color={viewMode === 'ai' ? theme.bg : theme.text} 
              />
              <Text 
                variant="small" 
                weight="semibold"
                color={viewMode === 'ai' ? theme.bg : theme.text}
              >
                AI Signals
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('legacy')}
              style={[
                styles.toggleButton,
                viewMode === 'legacy' && { backgroundColor: theme.primary }
              ]}
            >
              <Icon 
                name="chart" 
                size={18} 
                color={viewMode === 'legacy' ? theme.bg : theme.text} 
              />
              <Text 
                variant="small" 
                weight="semibold"
                color={viewMode === 'legacy' ? theme.bg : theme.text}
              >
                Legacy
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Asset Type Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}
        >
          {(['stocks', 'currencies', 'crypto', 'commodities', 'etfs'] as AssetType[]).map((asset) => (
            <Pressable
              key={asset}
              onPress={() => setSelectedAsset(asset)}
              style={styles.tab}
            >
              <Card
                style={{
                  ...styles.tabCard,
                  backgroundColor: selectedAsset === asset ? theme.primary : 'transparent'
                }}
                padding="sm"
              >
                <Text 
                  variant="small" 
                  weight="semibold"
                  color={selectedAsset === asset ? theme.bg : theme.text}
                  style={styles.tabText}
                >
                  {asset === 'etfs' ? 'ETFs' : asset.charAt(0).toUpperCase() + asset.slice(1)}
                </Text>
              </Card>
            </Pressable>
          ))}
        </ScrollView>

        {/* AI Signals List */}
        {viewMode === 'ai' && (
          <>
            <AISignalCard signal={SAMPLE_AI_SIGNAL} />
            <Text variant="small" muted center style={{ marginVertical: tokens.spacing.md }}>
              This is a sample AI signal. When connected to the API, you'll see the top 3 AI-recommended signals here.
            </Text>
          </>
        )}

        {/* Legacy Signals List */}
        {viewMode === 'legacy' && SIGNALS[selectedAsset].map((signal) => (
          <Pressable 
            key={signal.symbol}
            onPress={() => router.push('/explainability')}
          >
            <Card style={styles.signalCard}>
              <View style={styles.signalHeader}>
                <View style={styles.signalLeft}>
                  <Text variant="body" weight="bold">{signal.symbol}</Text>
                  <Text variant="xs" muted>{signal.name}</Text>
                </View>
                <Badge variant={getSignalVariant(signal.signal)} size="medium">
                  {signal.signal}
                </Badge>
              </View>

              <View style={styles.signalMetrics}>
                <View style={styles.metric}>
                  <Text variant="xs" muted>Price</Text>
                  <Text variant="small" weight="semibold">
                    ${signal.price.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text variant="xs" muted>Target</Text>
                  <Text variant="small" weight="semibold">
                    ${signal.target.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text variant="xs" muted>Change</Text>
                  <Text 
                    variant="small" 
                    weight="semibold"
                    color={signal.change > 0 ? theme.primary : theme.danger}
                  >
                    {signal.change > 0 ? '+' : ''}{signal.change}%
                  </Text>
                </View>
              </View>

              {/* Mini Candlestick Chart */}
              <CandlestickChart 
                data={signal.candleData.map(candle => ({
                  time: candle.timestamp,
                  open: candle.open,
                  high: candle.high,
                  low: candle.low,
                  close: candle.close
                }))} 
                chartType="daily"
              />

              {/* Confidence Bar */}
              <View style={styles.confidenceContainer}>
                <View style={styles.confidenceLabel}>
                  <Text variant="xs" muted>Confidence</Text>
                  <Text variant="xs" weight="semibold">{signal.confidence}%</Text>
                </View>
                <View style={[styles.confidenceBar, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.confidenceFill, 
                      { 
                        backgroundColor: getSignalColor(signal.signal),
                        width: `${signal.confidence}%` 
                      }
                    ]} 
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={styles.signalActions}>
                <Button
                  variant="secondary"
                  size="small"
                  onPress={() => router.push('/explainability')}
                  icon={<Icon name="lab" size={16} color={theme.primary} />}
                >
                  Explain
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onPress={() => router.push('/trade-setup')}
                  icon={<Icon name="execute" size={16} color={theme.bg} />}
                >
                  Trade
                </Button>
              </View>
            </Card>
          </Pressable>
        )))}

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Icon name="alert" size={20} color={theme.accent} />
          <Text variant="small" muted style={styles.infoText}>
            {viewMode === 'ai' 
              ? 'AI signals are generated using Multi-Agent Reinforcement Learning with comprehensive risk management. They include entry strategy, take profit levels, stop loss, and position sizing recommendations.'
              : 'Signals are generated using AI analysis of technical indicators, news sentiment, and market trends. Always do your own research before trading.'
            }
          </Text>
        </Card>

        {/* Bottom Spacing */}
        <View style={{ height: tokens.spacing.xl }} />
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
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabsContainer: {
    marginVertical: tokens.spacing.sm,
  },
  tabsContent: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  tabText: {
    whiteSpace: 'nowrap',
  },
  tab: {
    flex: 1,
  },
  tabCard: {
    alignItems: 'center',
  },
  signalCard: {
    gap: tokens.spacing.sm,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  signalLeft: {
    gap: 2,
  },
  signalMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000005',
  },
  metric: {
    gap: 2,
    alignItems: 'center',
  },
  confidenceContainer: {
    gap: tokens.spacing.xs,
  },
  confidenceLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceBar: {
    height: 6,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  signalActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  infoCard: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
});
