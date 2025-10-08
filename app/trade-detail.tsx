import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';
import CandlestickChart from '../components/CandlestickChart';
import { alphaVantageService, AlphaVantageCandleData } from '../services/alphaVantageService';

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const DEMO_SIGNAL = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  signal: 'BUY',
  confidence: 87,
  currentPrice: 175.50,
  targetPrice: 185.00,
  stopLoss: 168.00,
  change24h: +2.3,
  analysis: 'Strong bullish momentum with RSI indicating oversold conditions. MACD crossover suggests upward trend.',
};

export default function TradeDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { symbol } = useLocalSearchParams();
  const [activeTimeframe, setActiveTimeframe] = useState('1D');
  const [candleData, setCandleData] = useState<AlphaVantageCandleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSignal, setCurrentSignal] = useState(DEMO_SIGNAL);
  
  const timeframes = ['5M', '15M', '1H', '4H', '1D', '1W', '1M'];
  
  // Fetch real market data based on symbol
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setIsLoading(true);
        const symbolToFetch = (symbol as string) || 'AAPL';
        
        // Update signal with current symbol
        setCurrentSignal({
          ...DEMO_SIGNAL,
          symbol: symbolToFetch,
          name: getSymbolName(symbolToFetch)
        });
        
        // Fetch daily data
        const data = await alphaVantageService.getDailyData(symbolToFetch, 'compact');
        setCandleData(data.slice(-30)); // Last 30 days
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        // Fallback to mock data
        setCandleData([
          { time: '2024-01-01', open: 173.50, high: 175.20, low: 173.00, close: 174.80 },
          { time: '2024-01-02', open: 174.80, high: 176.50, low: 174.20, close: 175.90 },
          { time: '2024-01-03', open: 175.90, high: 177.00, low: 175.50, close: 176.30 },
          { time: '2024-01-04', open: 176.30, high: 176.80, low: 174.90, close: 175.20 },
          { time: '2024-01-05', open: 175.20, high: 176.40, low: 174.80, close: 176.00 },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
  }, [symbol]);

  // Helper function to get symbol name
  const getSymbolName = (symbol: string): string => {
    const symbolNames: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corp.',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corp.',
      'SPY': 'SPDR S&P 500 ETF',
      'QQQ': 'Invesco QQQ Trust',
      'IWM': 'iShares Russell 2000 ETF',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'COIN': 'Coinbase Global Inc.',
      'ARKK': 'ARK Innovation ETF'
    };
    return symbolNames[symbol] || `${symbol} Inc.`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Trade Details',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Instrument Header */}
        <Card style={styles.headerCard} elevation="med">
          <View style={styles.headerRow}>
            <View style={[styles.symbolCircle, { backgroundColor: theme.primary + '20' }]}>
              <Text variant="h2" weight="bold" color={theme.primary}>
                {currentSignal.symbol.slice(0, 1)}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text variant="h2" weight="bold">{currentSignal.symbol}</Text>
              <Text variant="small" muted>{currentSignal.name}</Text>
            </View>
            <Badge variant="success" size="medium">{currentSignal.signal}</Badge>
          </View>

          <View style={styles.priceSection}>
            <View>
              <Text variant="small" muted>Current Price</Text>
              <Text variant="h1" weight="bold">
                ${candleData.length > 0 ? candleData[candleData.length - 1]?.close?.toFixed(2) : currentSignal.currentPrice}
              </Text>
            </View>
            <View style={styles.changeBox}>
              <Icon name="market" size={18} color={theme.primary} />
              <Text variant="body" color={theme.primary} weight="bold">
                +{currentSignal.change24h}%
              </Text>
            </View>
          </View>
        </Card>

        {/* Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.timeframesRow}>
            {timeframes.map((tf) => (
              <Pressable
                key={tf}
                onPress={() => setActiveTimeframe(tf)}
                style={[
                  styles.timeframeButton,
                  activeTimeframe === tf && { backgroundColor: theme.primary }
                ]}
              >
                <Text 
                  variant="xs" 
                  weight="semibold"
                  color={activeTimeframe === tf ? theme.bg : theme.muted}
                >
                  {tf}
                </Text>
              </Pressable>
            ))}
          </View>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text variant="body" muted center>Loading chart data...</Text>
            </View>
          ) : (
            <CandlestickChart 
              data={candleData.map(candle => ({
                time: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
              }))}
              chartType="daily"
            />
          )}
        </Card>

        {/* Signal Details */}
        <Card style={styles.detailsCard}>
          <Text variant="h3" weight="semibold">Signal Details</Text>
          
          <View style={styles.detailRow}>
            <Text variant="small" muted>Confidence</Text>
            <View style={styles.confidenceRow}>
              <View style={[styles.confidenceBar, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.confidenceFill,
                    { backgroundColor: theme.primary, width: `${currentSignal.confidence}%` }
                  ]} 
                />
              </View>
              <Text variant="small" weight="bold">{currentSignal.confidence}%</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text variant="small" muted>Target Price</Text>
            <Text variant="body" weight="bold" color={theme.primary}>
              ${currentSignal.targetPrice}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="small" muted>Stop Loss</Text>
            <Text variant="body" weight="bold" color={theme.danger}>
              ${currentSignal.stopLoss}
            </Text>
          </View>
        </Card>

        {/* Analysis */}
        <Card style={styles.analysisCard}>
          <View style={styles.analysisHeader}>
            <Icon name="lab" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">AI Analysis</Text>
          </View>
          <Text variant="small" style={styles.analysisText}>
            {currentSignal.analysis}
          </Text>
          <Button 
            variant="secondary" 
            size="small"
            onPress={() => router.push('/explainability')}
            icon={<Icon name="lab" size={16} color={theme.primary} />}
          >
            View Full Analysis
          </Button>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            size="large"
            fullWidth
            icon={<Icon name="execute" size={20} color={theme.bg} />}
            onPress={() => router.push('/trade-setup')}
          >
            Execute Trade
          </Button>
          <Button
            variant="secondary"
            size="medium"
            fullWidth
            icon={<Icon name="bell" size={18} color={theme.primary} />}
          >
            Set Alert
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
  headerCard: {
    gap: tokens.spacing.md,
  },
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
    gap: 2,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.sm,
  },
  changeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  chartCard: {
    gap: tokens.spacing.sm,
  },
  timeframesRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  timeframeButton: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
  },
  detailsCard: {
    gap: tokens.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
    marginLeft: tokens.spacing.md,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  analysisCard: {
    gap: tokens.spacing.sm,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  analysisText: {
    lineHeight: 20,
  },
  actions: {
    gap: tokens.spacing.sm,
  },
  loadingContainer: {
    padding: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
});
