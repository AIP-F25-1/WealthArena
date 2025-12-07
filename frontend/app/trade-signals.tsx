import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, Badge, FAB, tokens, CandleData, TextInput } from '@/src/design-system';
import CandlestickChart from '../components/CandlestickChart';
import AISignalCard from '../components/AISignalCard';
import { SignalCardWithChart } from '../components/SignalCardWithChart';
import { AITradingSignal } from '../types/ai-signal';
import { rlAgentService } from '../services/rlAgentService';
import { getTopSignals, getHistoricalSignals, createPortfolioFromSignal } from '@/services/apiService';

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
  const [isLoadingRLData, setIsLoadingRLData] = useState(false);
  const [rlTopSetups, setRlTopSetups] = useState<any[]>([]);
  
  // Backend signals state
  const [backendSignals, setBackendSignals] = useState<any[]>([]);
  const [isLoadingBackendSignals, setIsLoadingBackendSignals] = useState(false);
  const [historicalSignals, setHistoricalSignals] = useState<any[]>([]);
  const [showHistorical, setShowHistorical] = useState(false);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);

  // Fetch RL Agent top setups when in AI mode
  useEffect(() => {
    if (viewMode === 'ai') {
      const fetchRLSetups = async () => {
        setIsLoadingRLData(true);
        try {
          // Map asset types to RL API format
          const assetTypeMap: Record<AssetType, string> = {
            'stocks': 'stocks',
            'currencies': 'currency_pairs',
            'crypto': 'crypto',
            'commodities': 'commodities',
            'etfs': 'stocks', // fallback to stocks
          };

          const response = await rlAgentService.getTopSetups(
            assetTypeMap[selectedAsset] as any,
            3,
            'medium'
          );
          
          setRlTopSetups(response.setups || []);
        } catch (error) {
          console.log('RL Agent service unavailable, using mock data');
          setRlTopSetups([]);
        } finally {
          setIsLoadingRLData(false);
        }
      };

      fetchRLSetups();
    }
  }, [viewMode, selectedAsset]);

  // Fetch backend signals when in legacy mode
  useEffect(() => {
    if (viewMode === 'legacy') {
      const fetchBackendSignals = async () => {
        setIsLoadingBackendSignals(true);
        try {
          const response = await getTopSignals(selectedAsset, 5);
          const signals = Array.isArray(response.data) ? response.data : [];
          setBackendSignals(signals);
        } catch (error) {
          console.error('Error fetching backend signals:', error);
          setBackendSignals([]);
        } finally {
          setIsLoadingBackendSignals(false);
        }
      };

      fetchBackendSignals();
    }
  }, [viewMode, selectedAsset]);

  // Fetch historical signals when toggle is enabled
  useEffect(() => {
    if (showHistorical && viewMode === 'legacy') {
      const fetchHistorical = async () => {
        try {
          const response = await getHistoricalSignals({ 
            limit: 20, 
            assetType: selectedAsset 
          });
          setHistoricalSignals(response.data || []);
        } catch (error) {
          console.error('Error fetching historical signals:', error);
          setHistoricalSignals([]);
        }
      };

      fetchHistorical();
    }
  }, [showHistorical, viewMode, selectedAsset]);

  // Handler for creating portfolio from signal
  const handleCreatePortfolioFromSignal = async (signal: any) => {
    Alert.prompt(
      'Create Portfolio from Signal',
      'Enter investment amount:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (amount) => {
            if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
              Alert.alert('Invalid Amount', 'Please enter a valid investment amount');
              return;
            }

            setIsCreatingPortfolio(true);
            try {
              const portfolioName = `${signal.Symbol} Signal Portfolio`;
              await createPortfolioFromSignal(signal.SignalID, portfolioName, parseFloat(amount));
              Alert.alert('Success', 'Portfolio created successfully!', [
                { text: 'OK', onPress: () => router.push('/portfolio-builder') }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to create portfolio from signal');
            } finally {
              setIsCreatingPortfolio(false);
            }
          }
        }
      ],
      'plain-text',
      '10000'
    );
  };

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
          headerShown: false,
        }}
      />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Trade Signals</Text>
        <View style={styles.headerRight} />
      </View>
      
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
            {isLoadingRLData ? (
              <View style={styles.loadingContainer}>
                <Text variant="small" muted center>Loading AI signals...</Text>
              </View>
            ) : rlTopSetups.length > 0 ? (
              rlTopSetups.map((setup, index) => (
                <AISignalCard key={setup.symbol || index} signal={setup} />
              ))
            ) : (
              <Card style={styles.emptyStateCard}>
                <Icon name="signal" size={48} color={theme.muted} />
                <Text variant="h3" weight="semibold" center style={{ marginTop: tokens.spacing.md }}>
                  No AI Signals Available
                </Text>
                <Text variant="small" muted center style={{ marginTop: tokens.spacing.sm }}>
                  AI signals are generated using Multi-Agent Reinforcement Learning. Check back later for new signals.
                </Text>
              </Card>
            )}
          </>
        )}

        {/* Legacy Signals List */}
        {viewMode === 'legacy' && (
          <>
            {/* View Historical Signals Toggle */}
            <Card style={styles.toggleCard}>
              <View style={styles.toggleRow}>
                <Text variant="body" weight="semibold">View Historical Signals</Text>
                <Pressable
                  onPress={() => setShowHistorical(!showHistorical)}
                  style={[
                    styles.toggleSwitch,
                    showHistorical && { backgroundColor: theme.primary }
                  ]}
                >
                  <View style={[
                    styles.toggleThumb,
                    showHistorical && { transform: [{ translateX: 20 }] }
                  ]} />
                </Pressable>
              </View>
            </Card>

            {/* Show historical signals if toggle is enabled */}
            {showHistorical ? (
              isLoadingBackendSignals ? (
                <Text variant="small" muted center>Loading historical signals...</Text>
              ) : historicalSignals.length > 0 ? (
                historicalSignals.map((signal) => (
                  <Card key={signal.SignalID} style={styles.signalCard}>
                    <View style={styles.signalHeader}>
                      <View style={styles.signalLeft}>
                        <Text variant="body" weight="bold">{signal.Symbol}</Text>
                        <Text variant="xs" muted>{signal.AssetType}</Text>
                      </View>
                      <Badge variant={getSignalVariant(signal.Signal)} size="medium">
                        {signal.Signal}
                      </Badge>
                    </View>

                    <View style={styles.signalMetrics}>
                      <View style={styles.metric}>
                        <Text variant="xs" muted>Entry Price</Text>
                        <Text variant="small" weight="semibold">
                          ${signal.EntryPrice?.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.metric}>
                        <Text variant="xs" muted>Exit Price</Text>
                        <Text variant="small" weight="semibold">
                          ${signal.ActualExitPrice?.toFixed(2) || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.metric}>
                        <Text variant="xs" muted>P&L</Text>
                        <Text 
                          variant="small" 
                          weight="semibold"
                          color={signal.ActualPnL > 0 ? theme.success : 
                                 signal.ActualPnL < 0 ? theme.danger : theme.muted}
                        >
                          ${signal.ActualPnL?.toFixed(2) || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.confidenceContainer}>
                      <View style={styles.confidenceLabel}>
                        <Text variant="xs" muted>Outcome</Text>
                        <Badge 
                          variant={
                            signal.Outcome === 'win' ? 'success' : 
                            signal.Outcome === 'loss' ? 'danger' : 'secondary'
                          }
                          size="small"
                        >
                          {signal.Outcome?.toUpperCase() || 'PENDING'}
                        </Badge>
                      </View>
                    </View>
                  </Card>
                ))
              ) : (
                <Text variant="small" muted center>No historical signals found</Text>
              )
            ) : (
              /* Show current/top signals */
              isLoadingBackendSignals ? (
                <Text variant="small" muted center>Loading signals...</Text>
              ) : backendSignals.length > 0 ? (
                backendSignals.map((signal) => (
                  <SignalCardWithChart
                    key={signal.SignalID}
                    signal={signal}
                    onExplain={() => router.push('/explainability')}
                    onCreatePortfolio={() => handleCreatePortfolioFromSignal(signal)}
                    getSignalColor={getSignalColor}
                    getSignalVariant={getSignalVariant}
                    theme={theme}
                    router={router}
                  />
                ))
              ) : (
                <Card style={styles.emptyStateCard}>
                  <Icon name="signal" size={48} color={theme.muted} />
                  <Text variant="h3" weight="semibold" center style={{ marginTop: tokens.spacing.md }}>
                    No Signals Available
                  </Text>
                  <Text variant="small" muted center style={{ marginTop: tokens.spacing.sm }}>
                    No trading signals found for {selectedAsset}. Check back later or try a different asset type.
                  </Text>
                </Card>
              )
            )}
          </>
        )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    height: 56,
  },
  backButton: {
    padding: tokens.spacing.xs,
    marginLeft: -tokens.spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: tokens.spacing.md,
  },
  headerRight: {
    width: 40,
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
    // React Native doesn't support whiteSpace - use numberOfLines on Text component instead
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
  toggleCard: {
    gap: tokens.spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  loadingContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLoading: {
    padding: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
});
