import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, TextInput, Icon, Badge, tokens, FAB } from '@/src/design-system';
import { AITradingSignal } from '../types/ai-signal';
import { rlAgentService } from '../services/rlAgentService';
import { marketDataService } from '../services/marketDataService';

// Mock AI Signal for demonstration (in production, this would come from params or API)
const MOCK_SIGNAL: AITradingSignal = {
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

// Helper function to convert RL prediction to AITradingSignal format
function convertRLPredictionToSignal(prediction: any, symbol: string): AITradingSignal {
  const entryPrice = prediction.entry?.price || prediction.current_price || 100;
  const takeProfit = prediction.take_profit || [];
  const stopLossData = prediction.stop_loss || {};
  
  return {
    symbol: symbol,
    prediction_date: prediction.timestamp || new Date().toISOString(),
    asset_type: prediction.asset_type || 'stock',
    trading_signal: {
      signal: prediction.signal || 'HOLD',
      confidence: prediction.confidence || 0.5,
      model_version: prediction.model_version || 'v2.3.1'
    },
    entry_strategy: {
      price: entryPrice,
      price_range: prediction.entry?.price_range || [entryPrice * 0.99, entryPrice * 1.01],
      timing: prediction.entry?.timing || 'immediate',
      reasoning: prediction.reasoning || prediction.entry?.reasoning || 'AI-generated signal'
    },
    take_profit_levels: takeProfit.map((tp: any, index: number) => ({
      level: index + 1,
      price: tp.price || tp,
      percent_gain: tp.percent_gain || ((tp.price || tp) / entryPrice - 1) * 100,
      close_percent: tp.close_percent || [50, 30, 20][index] || 50,
      probability: tp.probability || 0.7,
      reasoning: tp.reasoning || `Take profit level ${index + 1}`
    })),
    stop_loss: {
      price: stopLossData.price || entryPrice * 0.95,
      percent_loss: stopLossData.percent_loss || ((stopLossData.price || entryPrice * 0.95) / entryPrice - 1) * 100,
      type: stopLossData.type || 'fixed',
      trail_amount: stopLossData.trail_amount,
      reasoning: stopLossData.reasoning || 'Stop loss level'
    },
    risk_management: {
      risk_reward_ratio: prediction.risk_metrics?.risk_reward_ratio || 2.0,
      max_risk_per_share: Math.abs(entryPrice - (stopLossData.price || entryPrice * 0.95)),
      max_reward_per_share: takeProfit.length > 0 ? Math.abs((takeProfit[0].price || takeProfit[0]) - entryPrice) : entryPrice * 0.05,
      win_probability: prediction.risk_metrics?.win_probability || 0.6,
      expected_value: prediction.risk_metrics?.expected_value || 0
    },
    position_sizing: {
      recommended_percent: prediction.position_sizing?.recommended_percent || 5.0,
      dollar_amount: prediction.position_sizing?.dollar_amount || 5000,
      shares: prediction.position_sizing?.shares || Math.floor(5000 / entryPrice),
      max_loss: prediction.position_sizing?.max_loss || 250,
      method: prediction.position_sizing?.method || 'Kelly Criterion',
      kelly_fraction: prediction.position_sizing?.kelly_fraction,
      volatility_adjusted: prediction.position_sizing?.volatility_adjusted || true
    },
    model_metadata: {
      model_type: 'Multi-Agent RL',
      agents_used: ['TradingAgent', 'RiskAgent', 'PortfolioAgent'],
      training_date: new Date().toISOString().split('T')[0],
      backtest_sharpe: 1.95,
      feature_importance: {}
    },
    indicators_state: {
      rsi: { value: prediction.indicators?.rsi || 50, status: 'neutral' },
      macd: { value: prediction.indicators?.macd || 0, status: 'neutral' },
      atr: { value: prediction.indicators?.atr || 2, status: 'medium_volatility' },
      volume: { value: prediction.indicators?.volume_ratio || 1, status: 'average' },
      trend: { direction: prediction.signal === 'BUY' ? 'up' : 'down', strength: 'medium' }
    }
  };
}

export default function TradeSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  
  const [symbol, setSymbol] = useState<string>('');
  const [signal, setSignal] = useState<AITradingSignal>(MOCK_SIGNAL);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSymbol, setIsLoadingSymbol] = useState(true);
  const [orderType, setOrderType] = useState('market');
  const [quantity, setQuantity] = useState('0');
  const [limitPrice, setLimitPrice] = useState('0');
  const [stopLoss, setStopLoss] = useState('0');
  const [selectedTpLevel, setSelectedTpLevel] = useState(0);

  // First, get a real symbol from the dataset
  useEffect(() => {
    const loadSymbol = async () => {
      setIsLoadingSymbol(true);
      try {
        // Get symbol from params if provided
        const paramSymbol = params.symbol as string;
        if (paramSymbol) {
          setSymbol(paramSymbol);
          setIsLoadingSymbol(false);
          return;
        }

        // Otherwise, fetch available symbols from backend and use the first one
        const availableSymbols = await marketDataService.getAvailableSymbols();
        
        if (availableSymbols && availableSymbols.length > 0) {
          // Use the first available symbol
          const firstSymbol = availableSymbols[0];
          console.log(`Using real symbol from dataset: ${firstSymbol} (${availableSymbols.length} symbols available)`);
          setSymbol(firstSymbol);
        } else {
          // Fallback to a default (but this shouldn't happen if data is loaded)
          console.warn('No symbols available in dataset, using fallback');
          setSymbol('14D.AX'); // Default to an Australian stock format
        }
      } catch (error) {
        console.error('Error loading available symbols:', error);
        // Fallback symbol
        setSymbol('14D.AX');
      } finally {
        setIsLoadingSymbol(false);
      }
    };

    loadSymbol();
  }, [params.symbol]);

  // Fetch real prediction data once we have a symbol
  useEffect(() => {
    if (!symbol || isLoadingSymbol) return;

    const fetchPrediction = async () => {
      setIsLoading(true);
      try {
        console.log(`Fetching prediction for ${symbol}...`);
        const prediction = await rlAgentService.getPrediction(symbol, 1);
        
        // Check if we got a real prediction or fallback
        if (prediction.symbol && prediction.symbol !== symbol) {
          console.warn(`Prediction returned different symbol: ${prediction.symbol} vs ${symbol}`);
        }
        
        const convertedSignal = convertRLPredictionToSignal(prediction, symbol);
        setSignal(convertedSignal);
        setQuantity(convertedSignal.position_sizing.shares.toString());
        setLimitPrice(convertedSignal.entry_strategy.price.toString());
        setStopLoss(convertedSignal.stop_loss.price.toString());
        
        console.log(`✓ Successfully loaded prediction for ${symbol}`);
      } catch (error: any) {
        console.error(`Error fetching prediction for ${symbol}:`, error);
        
        // Try to get data from backend directly as fallback
        try {
          const backendUrl = await import('../utils/networkConfig').then(m => m.resolveBackendURL(3000));
          const { getAuthHeaders } = await import('../services/apiService');
          const response = await fetch(
            `${await backendUrl}/api/market-data/history/${symbol}?days=60`,
            { headers: await getAuthHeaders() }
          );
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              // Use the latest price from backend data
              const latestData = result.data[result.data.length - 1];
              const currentPrice = latestData.close || latestData.Close || 100;
              
              // Create a basic signal from backend data
              const basicSignal = convertRLPredictionToSignal({
                symbol: symbol,
                signal: 'HOLD',
                confidence: 0.5,
                current_price: currentPrice,
                timestamp: new Date().toISOString(),
                reasoning: 'Data loaded from backend, RL service unavailable'
              }, symbol);
              
              setSignal(basicSignal);
              setQuantity(basicSignal.position_sizing.shares.toString());
              setLimitPrice(basicSignal.entry_strategy.price.toString());
              setStopLoss(basicSignal.stop_loss.price.toString());
              
              Alert.alert(
                'Limited Data',
                `Using backend data for ${symbol}. RL service unavailable - some features may be limited.`,
                [{ text: 'OK' }]
              );
              return;
            }
          }
        } catch (backendError) {
          console.error('Backend fallback also failed:', backendError);
        }
        
        // Last resort: show error and use minimal mock data
        Alert.alert(
          'Data Unavailable',
          `Could not fetch prediction for ${symbol}.\n\n` +
          `Please ensure:\n` +
          `1. Backend is running\n` +
          `2. Symbol ${symbol} exists in your dataset\n` +
          `3. RL service is available`,
          [
            { text: 'Go Back', onPress: () => router.back() },
            { text: 'Retry', onPress: () => fetchPrediction() }
          ]
        );
        
        // Use minimal mock data with the correct symbol
        const mockWithSymbol = { 
          ...MOCK_SIGNAL, 
          symbol,
          entry_strategy: { ...MOCK_SIGNAL.entry_strategy, reasoning: 'Service unavailable - using fallback data' }
        };
        setSignal(mockWithSymbol);
        setQuantity(mockWithSymbol.position_sizing.shares.toString());
        setLimitPrice(mockWithSymbol.entry_strategy.price.toString());
        setStopLoss(mockWithSymbol.stop_loss.price.toString());
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrediction();
  }, [symbol, isLoadingSymbol]);

  if (isLoadingSymbol || isLoading || !symbol) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text variant="h3" weight="semibold" style={styles.headerTitle}>Trade Setup</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text variant="body" muted style={{ marginTop: tokens.spacing.md }}>
            {isLoadingSymbol ? 'Loading available symbols...' : `Loading prediction for ${symbol}...`}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Trade Setup</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Instrument Header */}
        <Card style={styles.headerCard} elevation="med">
          <View style={styles.headerContent}>
            <View style={[styles.symbolCircle, { backgroundColor: theme.primary + '20' }]}>
              <Text variant="h3" weight="bold" color={theme.primary}>
                {signal.symbol.charAt(0)}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text variant="h3" weight="bold">{signal.symbol}</Text>
              <Text variant="small" muted>{signal.asset_type.toUpperCase()}</Text>
            </View>
            <View style={styles.priceInfo}>
              <Text variant="h3" weight="bold">${signal.entry_strategy.price.toFixed(2)}</Text>
              <Badge 
                variant={
                  signal.trading_signal.signal === 'BUY' 
                    ? 'success' 
                    : signal.trading_signal.signal === 'SELL' 
                    ? 'danger' 
                    : 'secondary'
                } 
                size="medium"
              >
                {signal.trading_signal.signal}
              </Badge>
            </View>
          </View>
          
          {/* AI Confidence Bar */}
          <View style={styles.confidenceSection}>
            <View style={styles.confidenceLabel}>
              <Text variant="xs" muted>AI Confidence</Text>
              <Text variant="xs" weight="semibold">{(signal.trading_signal.confidence * 100).toFixed(0)}%</Text>
              </View>
            <View style={[styles.confidenceBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.confidenceFill, 
                  { 
                    backgroundColor: signal.trading_signal.signal === 'BUY' ? theme.primary : theme.danger,
                    width: `${signal.trading_signal.confidence * 100}%` 
                  }
                ]} 
              />
            </View>
          </View>
        </Card>

        {/* Order Type Tabs */}
        <View style={styles.tabsContainer}>
          {['market', 'limit', 'stop'].map((type) => (
            <Pressable
              key={type}
              onPress={() => setOrderType(type)}
              style={styles.tab}
            >
              <Card
                style={orderType === type ? { ...styles.tabCard, backgroundColor: theme.primary } : styles.tabCard}
                padding="sm"
              >
                <Text 
                  variant="small" 
                  weight="semibold"
                  color={orderType === type ? theme.bg : theme.text}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>

        {/* Order Details */}
        <Card style={styles.orderCard}>
          <View style={styles.sectionHeader}>
            <Text variant="body" weight="semibold">Order Details</Text>
            <Badge variant="secondary" size="small">AI Recommended</Badge>
          </View>
          
          <TextInput
            label="Quantity (Shares)"
            placeholder="Enter number of shares"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />

          {orderType !== 'market' && (
            <TextInput
              label={orderType === 'limit' ? 'Limit Price' : 'Stop Price'}
              placeholder="Enter price"
              value={limitPrice}
              onChangeText={setLimitPrice}
              keyboardType="decimal-pad"
            />
          )}

          <View style={styles.aiRecommendation}>
            <Icon name="agent" size={16} color={theme.accent} />
            <Text variant="xs" muted>
              AI suggests {signal.position_sizing.shares} shares (
              {signal.position_sizing.recommended_percent.toFixed(1)}% of portfolio)
            </Text>
          </View>

          <View style={styles.estimateRow}>
            <Text variant="small" muted>Estimated Total</Text>
            <Text variant="body" weight="bold">
              ${quantity ? (parseFloat(quantity) * signal.entry_strategy.price).toFixed(2) : '0.00'}
            </Text>
          </View>
        </Card>

        {/* Entry Strategy */}
        <Card style={styles.strategyCard}>
          <View style={styles.cardHeader}>
            <Icon name="target" size={20} color={theme.primary} />
            <Text variant="body" weight="semibold">Entry Strategy</Text>
          </View>
          <View style={styles.strategyDetails}>
            <View style={styles.strategyRow}>
              <Text variant="xs" muted>Entry Price</Text>
              <Text variant="small" weight="bold">${signal.entry_strategy.price.toFixed(2)}</Text>
            </View>
            <View style={styles.strategyRow}>
              <Text variant="xs" muted>Price Range</Text>
              <Text variant="small" weight="semibold">
                ${signal.entry_strategy.price_range[0].toFixed(2)} - ${signal.entry_strategy.price_range[1].toFixed(2)}
              </Text>
            </View>
            <View style={styles.strategyRow}>
              <Text variant="xs" muted>Timing</Text>
              <Badge variant="warning" size="small">{signal.entry_strategy.timing}</Badge>
            </View>
          </View>
          <View style={styles.reasoningBox}>
            <Text variant="xs" muted>{signal.entry_strategy.reasoning}</Text>
          </View>
        </Card>

        {/* Take Profit Levels */}
        <Card style={styles.tpCard}>
          <View style={styles.cardHeader}>
            <Icon name="trending-up" size={20} color={theme.primary} />
            <Text variant="body" weight="semibold">Take Profit Levels</Text>
          </View>
          {signal.take_profit_levels.map((tp, index) => (
            <Pressable
              key={tp.level}
              onPress={() => setSelectedTpLevel(index)}
              style={[
                styles.tpLevelCard,
                { borderColor: selectedTpLevel === index ? theme.primary : theme.border }
              ]}
            >
              <View style={styles.tpHeader}>
                <View style={styles.tpLeft}>
                  <Text variant="small" weight="bold">TP {tp.level}</Text>
                  <Text variant="h3" weight="bold" color={theme.primary}>
                    ${tp.price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.tpRight}>
                  <Text variant="small" color={theme.primary}>+{tp.percent_gain.toFixed(2)}%</Text>
                  <Text variant="xs" muted>{tp.close_percent}% close</Text>
                </View>
              </View>
              <View style={styles.tpMetrics}>
                <View style={styles.tpMetric}>
                  <Text variant="xs" muted>Probability</Text>
                  <View style={styles.probContainer}>
                    <View style={[styles.probBarSmall, { backgroundColor: theme.border }]}>
                      <View 
                        style={[
                          styles.probFillSmall, 
                          { 
                            backgroundColor: theme.primary,
                            width: `${tp.probability * 100}%` 
                          }
                        ]} 
                      />
                    </View>
                    <Text variant="xs" weight="semibold">{(tp.probability * 100).toFixed(0)}%</Text>
                  </View>
                </View>
              </View>
              <Text variant="xs" muted style={styles.tpReasoning}>{tp.reasoning}</Text>
            </Pressable>
          ))}
        </Card>

        {/* Stop Loss */}
        <Card style={{ ...styles.slCard, backgroundColor: `${theme.danger}10` }}>
          <View style={styles.cardHeader}>
            <Icon name="shield" size={20} color={theme.danger} />
            <Text variant="body" weight="semibold">Stop Loss</Text>
          </View>
          <View style={styles.slDetails}>
            <View style={styles.slRow}>
              <Text variant="xs" muted>Stop Price</Text>
              <Text variant="h3" weight="bold" color={theme.danger}>
                ${signal.stop_loss.price.toFixed(2)}
              </Text>
            </View>
            <View style={styles.slRow}>
              <Text variant="xs" muted>Loss %</Text>
              <Text variant="small" weight="bold" color={theme.danger}>
                {signal.stop_loss.percent_loss.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.slRow}>
              <Text variant="xs" muted>Type</Text>
              <Badge variant="danger" size="small">{signal.stop_loss.type}</Badge>
            </View>
            {signal.stop_loss.trail_amount && (
              <View style={styles.slRow}>
                <Text variant="xs" muted>Trail Amount</Text>
                <Text variant="small" weight="semibold">${signal.stop_loss.trail_amount.toFixed(2)}</Text>
              </View>
            )}
          </View>
          <TextInput
            label="Custom Stop Loss"
            placeholder="Enter stop loss price"
            value={stopLoss}
            onChangeText={setStopLoss}
            keyboardType="decimal-pad"
          />
          <View style={styles.reasoningBox}>
            <Text variant="xs" muted>{signal.stop_loss.reasoning}</Text>
          </View>
        </Card>

        {/* Risk Management */}
        <Card style={{ ...styles.riskCard, backgroundColor: `${theme.yellow}10` }}>
          <View style={styles.riskHeader}>
            <Icon name="alert" size={20} color={theme.yellow} />
            <Text variant="body" weight="semibold">Risk Management</Text>
          </View>
          <View style={styles.riskMetrics}>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Risk/Reward Ratio</Text>
              <Text variant="h3" weight="bold" color={theme.primary}>
                {signal.risk_management.risk_reward_ratio.toFixed(2)}:1
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Win Probability</Text>
              <Text variant="h3" weight="bold">
                {(signal.risk_management.win_probability * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
          <View style={styles.riskMetrics}>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Max Risk/Share</Text>
              <Text variant="small" weight="semibold" color={theme.danger}>
                ${signal.risk_management.max_risk_per_share.toFixed(2)}
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Max Reward/Share</Text>
              <Text variant="small" weight="semibold" color={theme.primary}>
                ${signal.risk_management.max_reward_per_share.toFixed(2)}
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Expected Value</Text>
              <Text variant="small" weight="semibold">
                ${signal.risk_management.expected_value.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.riskMetrics}>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Position Size</Text>
              <Text variant="small" weight="semibold">
                {signal.position_sizing.recommended_percent.toFixed(1)}% of portfolio
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text variant="xs" muted>Max Loss</Text>
              <Text variant="small" weight="semibold" color={theme.danger}>
                ${signal.position_sizing.max_loss.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.methodBox}>
            <Icon name="lab" size={16} color={theme.accent} />
            <Text variant="xs" muted>
              Position sizing method: {signal.position_sizing.method}
              {signal.position_sizing.kelly_fraction && 
                ` (Kelly Fraction: ${signal.position_sizing.kelly_fraction.toFixed(3)})`
              }
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="large"
            fullWidth
            icon={<Icon name="check-shield" size={20} color={theme.bg} />}
            onPress={() => {
              router.back();
            }}
          >
            Place Order
          </Button>
          <Button
            variant="ghost"
            size="medium"
            fullWidth
            onPress={() => router.back()}
          >
            Cancel
          </Button>
        </View>

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
      
      <FAB onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {
    gap: tokens.spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  symbolCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  priceInfo: {
    alignItems: 'flex-end',
    gap: 4,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceSection: {
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
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
  tabsContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  tab: {
    flex: 1,
  },
  tabCard: {
    alignItems: 'center',
  },
  orderCard: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000005',
  },
  strategyCard: {
    gap: tokens.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  strategyDetails: {
    gap: tokens.spacing.xs,
  },
  strategyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasoningBox: {
    padding: tokens.spacing.sm,
    backgroundColor: '#00000005',
    borderRadius: tokens.radius.sm,
    marginTop: tokens.spacing.xs,
  },
  tpCard: {
    gap: tokens.spacing.sm,
  },
  tpLevelCard: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  tpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tpLeft: {
    gap: 2,
  },
  tpRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tpMetrics: {
    marginTop: tokens.spacing.xs,
  },
  tpMetric: {
    gap: 4,
  },
  probContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  probBarSmall: {
    width: 80,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  probFillSmall: {
    height: '100%',
    borderRadius: 2,
  },
  tpReasoning: {
    marginTop: tokens.spacing.xs,
  },
  slCard: {
    gap: tokens.spacing.sm,
  },
  slDetails: {
    gap: tokens.spacing.sm,
  },
  slRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskCard: {
    gap: tokens.spacing.sm,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  riskMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  riskItem: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  methodBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    backgroundColor: '#00000005',
    borderRadius: tokens.radius.sm,
    marginTop: tokens.spacing.xs,
  },
  actions: {
    gap: tokens.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
});
