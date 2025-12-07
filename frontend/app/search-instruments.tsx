import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, TextInput, Icon, Badge, Sparkline, FAB, tokens } from '@/src/design-system';
import { portfolioService } from '@/services/portfolioService';
import { alphaVantageService } from '@/services/alphaVantageService';

interface Instrument {
  symbol: string;
  name: string;
  type: 'Stock' | 'Crypto' | 'Forex' | 'ETF' | 'Commodity';
  change: number;
  price?: number;
  sparklineData?: number[];
}

export default function SearchInstrumentsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Popular symbols to fetch
  const POPULAR_SYMBOLS = [
    { symbol: 'AAPL', type: 'Stock' as const },
    { symbol: 'MSFT', type: 'Stock' as const },
    { symbol: 'GOOGL', type: 'Stock' as const },
    { symbol: 'AMZN', type: 'Stock' as const },
    { symbol: 'TSLA', type: 'Stock' as const },
    { symbol: 'SPY', type: 'ETF' as const },
    { symbol: 'QQQ', type: 'ETF' as const },
    { symbol: 'BTC-USD', type: 'Crypto' as const },
    { symbol: 'ETH-USD', type: 'Crypto' as const },
  ];

  // Fetch real market data for instruments
  const fetchInstruments = async () => {
    try {
      setIsLoading(true);
      
      // Try to get market opportunities from portfolio service first
      try {
        const opportunities = await portfolioService.getMarketOpportunities();
        if (opportunities && opportunities.length > 0) {
          const instrumentsData = await Promise.all(
            opportunities.map(async (opp) => {
              try {
                // Get sparkline data (last 7 days)
                const marketData = opp.data || [];
                const sparklineData = marketData.slice(-7).map((c: any) => c.close || c.c || 0);
                
                return {
                  symbol: opp.symbol,
                  name: opp.name,
                  type: opp.symbol.includes('-USD') ? 'Crypto' as const :
                        opp.symbol.includes('/') ? 'Forex' as const :
                        opp.symbol.length <= 4 ? 'Stock' as const : 'ETF' as const,
                  change: opp.change,
                  price: opp.value / (opp.shares || 1),
                  sparklineData: sparklineData.length > 0 ? sparklineData : undefined,
                };
              } catch (error) {
                console.warn(`Failed to process ${opp.symbol}:`, error);
                return null;
              }
            })
          );
          
          const validInstruments = instrumentsData.filter((item): item is Instrument => item !== null);
          if (validInstruments.length > 0) {
            setInstruments(validInstruments);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch opportunities, trying popular symbols:', error);
      }

      // Fallback: Fetch popular symbols with real data
      const instrumentsData = await Promise.all(
        POPULAR_SYMBOLS.map(async ({ symbol, type }) => {
          try {
            const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
            if (marketData && marketData.length > 0) {
              const latest = marketData[marketData.length - 1];
              const previous = marketData.length > 1 ? marketData[marketData.length - 2] : latest;
              const change = previous ? ((latest.close - previous.close) / previous.close) * 100 : 0;
              const sparklineData = marketData.slice(-7).map(c => c.close);
              
              return {
                symbol: symbol.replace('-USD', ''),
                name: symbol.replace('-USD', ''),
                type,
                change,
                price: latest.close,
                sparklineData,
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch data for ${symbol}:`, error);
          }
          return null;
        })
      );

      const validInstruments = instrumentsData.filter((item): item is Instrument => item !== null);
      setInstruments(validInstruments.length > 0 ? validInstruments : []);
    } catch (error) {
      console.error('Failed to fetch instruments:', error);
      setInstruments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstruments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInstruments();
    setRefreshing(false);
  };

  const filteredInstruments = instruments.filter(
    (item) =>
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Search</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Header */}
        <Card style={styles.searchCard}>
          <Icon name="market" size={28} color={theme.primary} />
          <Text variant="h3" weight="bold">Search Instruments</Text>
        </Card>

        {/* Search Input */}
        <TextInput
          placeholder="Search stocks, crypto, forex..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          rightIcon={<Icon name="market" size={20} color={theme.muted} />}
        />

        {/* Results */}
        <Text variant="body" weight="semibold" style={styles.resultsTitle}>
          {isLoading ? 'Loading instruments...' : searchQuery ? `Results (${filteredInstruments.length})` : 'Popular Instruments'}
        </Text>

        {isLoading && (
          <Card style={styles.emptyCard}>
            <Text variant="small" muted center>Loading market data...</Text>
          </Card>
        )}

        {!isLoading && filteredInstruments.length === 0 && (
          <Card style={styles.emptyCard}>
            <Icon name="market" size={48} color={theme.muted} />
            <Text variant="h3" weight="semibold" center>No Results</Text>
            <Text variant="small" muted center>
              {searchQuery ? 'Try searching with a different keyword' : 'Unable to load market data. Pull to refresh.'}
            </Text>
          </Card>
        )}

        {!isLoading && filteredInstruments.map((item) => (
          <Pressable 
            key={item.symbol}
            onPress={() => router.push(`/trade-detail?symbol=${item.symbol}`)}
          >
            <Card style={styles.instrumentCard}>
              <View style={styles.instrumentHeader}>
                <View style={styles.instrumentLeft}>
                  <View style={[styles.symbolCircle, { backgroundColor: theme.primary + '20' }]}>
                    <Text variant="body" weight="bold">
                      {item.symbol.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.instrumentInfo}>
                    <Text variant="body" weight="semibold">{item.symbol}</Text>
                    <Text variant="small" muted>{item.name}</Text>
                  </View>
                </View>
                <Badge variant={item.type === 'Stock' ? 'primary' : item.type === 'Crypto' ? 'warning' : 'secondary'} size="small">
                  {item.type}
                </Badge>
              </View>

              <View style={styles.instrumentFooter}>
                {item.sparklineData && item.sparklineData.length > 0 ? (
                  <Sparkline 
                    data={item.sparklineData}
                    width={100}
                    height={30}
                    color={item.change > 0 ? theme.primary : theme.danger}
                  />
                ) : (
                  <View style={{ width: 100, height: 30, justifyContent: 'center', alignItems: 'center' }}>
                    <Text variant="xs" muted>No chart data</Text>
                  </View>
                )}
                <View style={{ alignItems: 'flex-end' }}>
                  {item.price && (
                    <Text variant="small" muted>
                      ${item.price.toFixed(2)}
                    </Text>
                  )}
                  <Text 
                    variant="body" 
                    weight="bold"
                    color={item.change > 0 ? theme.primary : theme.danger}
                  >
                    {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}


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
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  resultsTitle: {
    marginTop: tokens.spacing.xs,
  },
  instrumentCard: {
    gap: tokens.spacing.sm,
  },
  instrumentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  instrumentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  symbolCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrumentInfo: {
    gap: 2,
  },
  instrumentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xl,
  },
});
