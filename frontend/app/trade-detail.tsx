import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
        const symbolToFetch = (symbol as string);
        
        if (!symbolToFetch) {
          setIsLoading(false);
          return;
        }
        
        // Update signal with current symbol
        setCurrentSignal({
          ...DEMO_SIGNAL,
          symbol: symbolToFetch,
          name: getSymbolName(symbolToFetch)
        });
        
        // Try Alpha Vantage first
        try {
          const data = await alphaVantageService.getDailyData(symbolToFetch, 'compact');
          if (data && data.length > 0) {
            setCandleData(data.slice(-30)); // Last 30 days
            setIsLoading(false);
            return;
          }
        } catch (avError) {
          console.warn('Alpha Vantage failed, trying chatbot API...');
        }
        
        // Fallback to chatbot market API (uses yfinance)
        try {
          const chatbotUrl = process.env.EXPO_PUBLIC_CHATBOT_URL || 'http://localhost:8000';
          const response = await fetch(
            `${chatbotUrl}/v1/market/ohlc?symbol=${symbolToFetch}&period=1mo&interval=1d`
          );
          
          if (response.ok) {
            const ohlcData = await response.json();
            if (ohlcData.candles && ohlcData.candles.length > 0) {
              const data = ohlcData.candles.map((candle: any) => ({
                time: new Date(candle.t * 1000).toISOString().split('T')[0],
                open: candle.o,
                high: candle.h,
                low: candle.l,
                close: candle.c,
              }));
              setCandleData(data.slice(-30));
              setIsLoading(false);
              return;
            }
          }
        } catch (chatbotError) {
          console.warn('Chatbot API also failed:', chatbotError);
        }
        
        // If all APIs fail, show empty state instead of mock data
        setCandleData([]);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        setCandleData([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (symbol) {
      fetchMarketData();
    }
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
          headerShown: false,
        }}
      />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Trade Details</Text>
        <View style={styles.headerRight} />
      </View>
      
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
