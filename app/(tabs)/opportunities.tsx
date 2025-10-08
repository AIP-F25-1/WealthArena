import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Icon, 
  Badge,
  FAB,
  tokens 
} from '@/src/design-system';
import CandlestickChart from '../../components/CandlestickChart';
import { portfolioService, PortfolioItem, PortfolioData } from '../../services/portfolioService';

export default function OpportunitiesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [marketOpportunities, setMarketOpportunities] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch portfolio and market opportunities data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [portfolio, opportunities] = await Promise.all([
          portfolioService.getPortfolioData(),
          portfolioService.getMarketOpportunities()
        ]);
        setPortfolioData(portfolio);
        setMarketOpportunities(opportunities);
      } catch (error) {
        console.error('Failed to fetch portfolio data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="portfolio" size={28} color={theme.primary} />
          <Text variant="h2" weight="bold">Opportunities</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button 
            variant="primary" 
            size="large"
            onPress={() => router.push('/portfolio-builder')}
            fullWidth
            icon={<Icon name="portfolio" size={20} color={theme.bg} />}
          >
            Build Portfolio
          </Button>
          
          <Button 
            variant="secondary" 
            size="large"
            onPress={() => router.push('/analytics')}
            fullWidth
            icon={<Icon name="market" size={20} color={theme.primary} />}
          >
            View Analytics
          </Button>
        </View>

        {/* Total Value Card */}
        {isLoading && (
          <Card elevation="med" style={styles.totalCard}>
            <Text variant="small" muted>Loading portfolio data...</Text>
          </Card>
        )}
        {!isLoading && portfolioData && (
          <Card elevation="med" style={styles.totalCard}>
            <Text variant="small" muted>Total Portfolio Value</Text>
            <Text variant="h1" weight="bold" style={styles.totalValue}>
              ${portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={styles.changeRow}>
              <Icon name="market" size={20} color={theme.primary} />
              <Text variant="body" color={theme.primary} weight="semibold">
                +${(portfolioData.totalValue * portfolioData.totalChange / 100).toFixed(2)} ({portfolioData.totalChange}%)
              </Text>
            </View>
          </Card>
        )}

        {/* Quick Analytics Preview */}
        {!isLoading && portfolioData && (
          <Pressable onPress={() => router.push('/analytics')}>
            <Card style={styles.analyticsPreview} elevation="med">
              <View style={styles.analyticsPreviewHeader}>
                <Icon name="market" size={24} color={theme.accent} />
                <Text variant="h3" weight="semibold">Portfolio Analytics</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.muted} />
              </View>
              <View style={styles.analyticsMetrics}>
                <View style={styles.analyticsMetric}>
                  <Text variant="small" muted>YTD Return</Text>
                  <Text variant="body" weight="bold" color={theme.primary}>+18.5%</Text>
                </View>
                <View style={styles.analyticsMetric}>
                  <Text variant="small" muted>Sharpe Ratio</Text>
                  <Text variant="body" weight="bold">1.82</Text>
                </View>
                <View style={styles.analyticsMetric}>
                  <Text variant="small" muted>Max Drawdown</Text>
                  <Text variant="body" weight="bold" color={theme.danger}>-12.3%</Text>
                </View>
              </View>
              <Text variant="xs" muted style={styles.analyticsNote}>
                Tap to view detailed analytics and performance charts
              </Text>
            </Card>
          </Pressable>
        )}

        {/* Holdings List */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Your Holdings
          </Text>
          
          {isLoading && (
            <Card style={styles.holdingCard}>
              <Text variant="small" muted center>Loading holdings...</Text>
            </Card>
          )}
          {!isLoading && portfolioData?.items.map((item) => (
            <Pressable key={item.symbol} onPress={() => router.push(`/trade-detail?symbol=${item.symbol}`)}>
              <Card style={styles.holdingCard}>
                <View style={styles.holdingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                    <Text variant="body" weight="bold">{item.symbol.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.holdingInfo}>
                    <Text variant="body" weight="semibold">{item.symbol}</Text>
                    <Text variant="small" muted>{item.name}</Text>
                    <Text variant="xs" muted>{item.shares} shares</Text>
                  </View>
                </View>
                
                <View style={styles.holdingRight}>
                  <Text variant="body" weight="bold">
                    ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  <View style={styles.changeRow}>
                    <Icon 
                      name={item.change > 0 ? "market" : "signal"} 
                      size={14} 
                      color={item.change > 0 ? theme.primary : theme.danger} 
                    />
                    <Text 
                      variant="small" 
                      color={item.change > 0 ? theme.primary : theme.danger}
                      weight="semibold"
                    >
                      {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        {/* Market Opportunities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h3" weight="semibold">Market Opportunities</Text>
            <Pressable onPress={() => router.push('/search-instruments')}>
              <Text variant="small" color={theme.primary} weight="semibold">View All</Text>
            </Pressable>
          </View>
          
          {marketOpportunities.map((opportunity, index) => (
            <Pressable key={opportunity.symbol} onPress={() => router.push(`/trade-detail?symbol=${opportunity.symbol}`)}>
              <Card style={styles.opportunityCard}>
                <View style={styles.opportunityHeader}>
                  <Text variant="body" weight="semibold">{opportunity.name}</Text>
                  <Badge variant={index === 0 ? 'success' : 'warning'} size="small">
                    {index === 0 ? 'Hot' : 'Trending'}
                  </Badge>
                </View>
                <Text variant="small" muted style={styles.opportunityText}>
                  ${opportunity.value.toFixed(2)} • {opportunity.change > 0 ? '+' : ''}{opportunity.change.toFixed(2)}%
                </Text>
                {opportunity.data && opportunity.data.length > 0 ? (
                  <CandlestickChart 
                    data={opportunity.data.map(candle => ({
                      time: candle.time,
                      open: candle.open,
                      high: candle.high,
                      low: candle.low,
                      close: candle.close
                    }))} 
                    chartType="daily"
                  />
                ) : (
                  <View style={styles.loadingContainer}>
                    <Text variant="small" muted center>No chart data available</Text>
                  </View>
                )}
              </Card>
            </Pressable>
          ))}
        </View>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  actionButtons: {
    gap: tokens.spacing.sm,
  },
  totalCard: {
    gap: tokens.spacing.sm,
  },
  totalValue: {
    marginVertical: tokens.spacing.xs,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  holdingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdingInfo: {
    flex: 1,
    gap: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
    gap: tokens.spacing.xs,
  },
  opportunityCard: {
    gap: tokens.spacing.xs,
  },
  opportunityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opportunityText: {
    marginBottom: tokens.spacing.xs,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsPreview: {
    gap: tokens.spacing.sm,
  },
  analyticsPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analyticsMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  analyticsMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  analyticsNote: {
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
  },
});
