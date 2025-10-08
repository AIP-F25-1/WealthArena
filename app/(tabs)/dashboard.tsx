import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Header, 
  FAB, 
  Icon, 
  Badge,
  ProgressRing,
  FoxMascot,
  tokens 
} from '@/src/design-system';
import CandlestickChart from '../../components/CandlestickChart';
import { mockDailyData } from '../../data/mockCandleData';
import { alphaVantageService, AlphaVantageCandleData } from '../../services/alphaVantageService';
import { newsService, NewsArticle } from '../../services/newsService';
import { useUserSettings } from '../../contexts/UserSettingsContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [marketData, setMarketData] = useState<AlphaVantageCandleData[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [topNews, setTopNews] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isNewsExpanded, setIsNewsExpanded] = useState(false);
  const { settings } = useUserSettings();
  const showNewsPreview = settings.showNews;

  // Mock data
  const portfolioValue = 24580;
  const dailyPnL = 842;
  const winRate = 68;
  const rank = 245;
  const dailyQuestProgress = 33; // 1 of 3 completed
  
  // Fetch real market data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setIsLoadingMarket(true);
        const data = await alphaVantageService.getSP500Data();
        setMarketData(data);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        // Fallback to mock data
        setMarketData(mockDailyData);
      } finally {
        setIsLoadingMarket(false);
      }
    };

    fetchMarketData();
  }, []);

  // Fetch top news
  useEffect(() => {
    const fetchTopNews = async () => {
      try {
        setIsLoadingNews(true);
        const news = await newsService.getHighImpactNews();
        setTopNews(news.slice(0, 3)); // Show top 3 high-impact news
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setIsLoadingNews(false);
      }
    };

    fetchTopNews();
  }, []);
  
  // Market candlestick data (S&P 500) - 30 days for daily chart
  const marketCandleData = marketData.length > 0 ? marketData : [
    { timestamp: 'Day 1', open: 4515, high: 4525, low: 4510, close: 4520 },
    { timestamp: 'Day 2', open: 4520, high: 4535, low: 4515, close: 4530 },
    { timestamp: 'Day 3', open: 4530, high: 4540, low: 4525, close: 4535 },
    { timestamp: 'Day 4', open: 4535, high: 4545, low: 4530, close: 4540 },
    { timestamp: 'Day 5', open: 4540, high: 4550, low: 4535, close: 4545 },
    { timestamp: 'Day 6', open: 4545, high: 4555, low: 4540, close: 4550 },
    { timestamp: 'Day 7', open: 4550, high: 4560, low: 4545, close: 4555 },
    { timestamp: 'Day 8', open: 4555, high: 4565, low: 4550, close: 4560 },
    { timestamp: 'Day 9', open: 4560, high: 4570, low: 4555, close: 4565 },
    { timestamp: 'Day 10', open: 4565, high: 4575, low: 4560, close: 4570 },
    { timestamp: 'Day 11', open: 4570, high: 4580, low: 4565, close: 4575 },
    { timestamp: 'Day 12', open: 4575, high: 4585, low: 4570, close: 4580 },
    { timestamp: 'Day 13', open: 4580, high: 4590, low: 4575, close: 4585 },
    { timestamp: 'Day 14', open: 4585, high: 4595, low: 4580, close: 4590 },
    { timestamp: 'Day 15', open: 4590, high: 4600, low: 4585, close: 4595 },
    { timestamp: 'Day 16', open: 4595, high: 4605, low: 4590, close: 4600 },
    { timestamp: 'Day 17', open: 4600, high: 4610, low: 4595, close: 4605 },
    { timestamp: 'Day 18', open: 4605, high: 4615, low: 4600, close: 4610 },
    { timestamp: 'Day 19', open: 4610, high: 4620, low: 4605, close: 4615 },
    { timestamp: 'Day 20', open: 4615, high: 4625, low: 4610, close: 4620 },
    { timestamp: 'Day 21', open: 4620, high: 4630, low: 4615, close: 4625 },
    { timestamp: 'Day 22', open: 4625, high: 4635, low: 4620, close: 4630 },
    { timestamp: 'Day 23', open: 4630, high: 4640, low: 4625, close: 4635 },
    { timestamp: 'Day 24', open: 4635, high: 4645, low: 4630, close: 4640 },
    { timestamp: 'Day 25', open: 4640, high: 4650, low: 4635, close: 4645 },
    { timestamp: 'Day 26', open: 4645, high: 4655, low: 4640, close: 4650 },
    { timestamp: 'Day 27', open: 4650, high: 4660, low: 4645, close: 4655 },
    { timestamp: 'Day 28', open: 4655, high: 4665, low: 4650, close: 4660 },
    { timestamp: 'Day 29', open: 4660, high: 4670, low: 4655, close: 4665 },
    { timestamp: 'Day 30', open: 4665, high: 4675, low: 4660, close: 4670 },
  ];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const lastUpdated = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Simple placeholder market status. Replace with server-provided status when available.
  const marketStatus: 'open' | 'closed' | 'pre' | 'post' | 'unknown' = useMemo(() => {
    // Example: U.S. market hours approximation (Mon-Fri, 9:30-16:00 ET). Local device time used as placeholder.
    const now = new Date();
    const day = now.getDay(); // 0 Sun ... 6 Sat
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;
    const openMinutes = 9 * 60 + 30; // 9:30
    const closeMinutes = 16 * 60; // 16:00
    if (day === 0 || day === 6) return 'closed';
    if (totalMinutes < openMinutes) return 'pre';
    if (totalMinutes >= openMinutes && totalMinutes < closeMinutes) return 'open';
    return 'post';
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <Header 
        greeting={greeting}
        userName="Wealthman Trader" 
        showNotifications 
        lastUpdated={lastUpdated}
        marketStatus={marketStatus}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio Balance Hero Card */}
        <Card style={styles.heroCard} elevation="med">
          <View style={styles.balanceHeader}>
            <View>
              <Text variant="small" muted>Portfolio Value</Text>
              <Text variant="h1" weight="bold" style={styles.balanceAmount}>
                ${portfolioValue.toLocaleString()}
              </Text>
              <View style={styles.pnlRow}>
                <Icon name="market" size={16} color={theme.primary} />
                <Text variant="small" color={theme.primary} weight="semibold">
                  +${dailyPnL} Today
                </Text>
              </View>
            </View>
            <FoxMascot variant="excited" size={80} />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Button 
              variant="primary" 
              size="small"
              icon={<Icon name="market" size={18} color={theme.bg} />}
              onPress={() => router.push('/search-instruments')}
            >
              Explore
            </Button>
            <Button 
              variant="secondary" 
              size="small"
              icon={<Icon name="portfolio" size={18} color={theme.primary} />}
              onPress={() => router.push('/portfolio-builder')}
            >
              Build
            </Button>
            <Button 
              variant="secondary" 
              size="small"
              icon={<Icon name="execute" size={18} color={theme.primary} />}
              onPress={() => router.push('/trade-setup')}
            >
              Trade
            </Button>
          </View>
        </Card>

        {/* Market Snapshot */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="market" size={24} color={theme.primary} />
              <Text variant="h3" weight="semibold">Market Snapshot</Text>
            </View>
            <Pressable onPress={() => router.push('/analytics')}>
              <Text variant="small" color={theme.primary} weight="semibold">View All</Text>
            </Pressable>
          </View>
          {isLoadingMarket ? (
            <View style={styles.loadingContainer}>
              <Text variant="small" muted>Loading market data...</Text>
            </View>
          ) : (
            <CandlestickChart 
              data={marketCandleData.map(candle => ({
                time: 'time' in candle ? candle.time : candle.timestamp,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
              }))} 
              chartType="daily"
            />
          )}
          <Text variant="small" muted style={styles.marketNote}>
            S&P 500 up 2.4% this week
          </Text>
        </Card>

        {/* Daily Quest Progress */}
        <Pressable onPress={() => router.push('/daily-quests')}>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Icon name="trophy" size={24} color={theme.yellow} />
                <Text variant="h3" weight="semibold">Daily Quests</Text>
              </View>
              <ProgressRing progress={dailyQuestProgress} size={50} showLabel={false} />
            </View>
            <Text variant="small" muted>Complete 3 quests today to earn rewards</Text>
            <View style={styles.questList}>
              <View style={styles.questItem}>
                <Icon name="check-shield" size={18} color={theme.primary} />
                <Text variant="small" style={styles.questText}>Review 5 trade signals</Text>
              </View>
              <View style={styles.questItem}>
                <Icon name="shield" size={18} color={theme.muted} />
                <Text variant="small" muted style={styles.questText}>Adjust portfolio risk</Text>
              </View>
              <View style={styles.questItem}>
                <Icon name="lab" size={18} color={theme.muted} />
                <Text variant="small" muted style={styles.questText}>Test a strategy</Text>
              </View>
            </View>
          </Card>
        </Pressable>

        {/* News Widget - Only show when news is enabled */}
        {showNewsPreview && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Icon name="newspaper" size={24} color={theme.primary} />
                <Text variant="h3" weight="semibold">Market News</Text>
                {topNews.length > 0 && (
                  <Badge variant="primary" size="small">
                    {topNews.length}
                  </Badge>
                )}
              </View>
              <View style={styles.newsControls}>
                <Pressable 
                  onPress={() => setIsNewsExpanded(!isNewsExpanded)}
                  style={styles.expandButton}
                >
                  <Icon 
                    name={isNewsExpanded ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color={theme.primary} 
                  />
                </Pressable>
                <Pressable onPress={() => router.push('/news')}>
                  <Text variant="small" color={theme.primary} weight="semibold">All</Text>
                </Pressable>
              </View>
            </View>
            
            {isLoadingNews ? (
              <View style={styles.newsLoadingContainer}>
                <Text variant="small" muted>Loading news...</Text>
              </View>
            ) : topNews.length > 0 ? (
              <>
                {/* Always show the first news item */}
                <Pressable
                  onPress={() => router.push('/news')}
                  style={styles.newsPreviewItem}
                >
                  <View style={styles.newsPreviewHeader}>
                    <View style={styles.newsPreviewMeta}>
                      <Text variant="small" muted>
                        {topNews[0].source} • {new Date(topNews[0].publishedAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Text>
                      <Badge 
                        variant="danger" 
                        style={{ 
                          backgroundColor: (() => {
                            if (topNews[0].impact === 'high') return theme.danger;
                            if (topNews[0].impact === 'medium') return theme.warning;
                            return theme.success;
                          })()
                        }}
                        size="small"
                      >
                        {topNews[0].impact.toUpperCase()}
                      </Badge>
                    </View>
                  </View>
                  
                  <Text variant="body" weight="semibold" style={styles.newsPreviewTitle}>
                    {topNews[0].title}
                  </Text>
                  
                  <View style={styles.newsPreviewFooter}>
                    <View style={styles.newsCategory}>
                      <Icon 
                        name={newsService.getCategoryIcon(topNews[0].category)} 
                        size={14} 
                        color={theme.primary} 
                      />
                      <Text variant="small" color={theme.primary}>
                        {topNews[0].category.toUpperCase()}
                      </Text>
                    </View>
                    
                    {topNews[0].relatedStocks && topNews[0].relatedStocks.length > 0 && (
                      <Text variant="small" muted>
                        {topNews[0].relatedStocks.slice(0, 2).join(', ')}
                        {topNews[0].relatedStocks.length > 2 && ` +${topNews[0].relatedStocks.length - 2}`}
                      </Text>
                    )}
                  </View>
                </Pressable>

                {/* Show additional news items when expanded */}
                {isNewsExpanded && topNews.length > 1 && (
                  <View style={styles.expandedNewsContainer}>
                    {topNews.slice(1).map((article, index) => (
                      <Pressable
                        key={article.id}
                        onPress={() => router.push('/news')}
                        style={[
                          styles.newsItem,
                          index < topNews.length - 2 && styles.newsItemBorder
                        ]}
                      >
                        <View style={styles.newsItemHeader}>
                          <View style={styles.newsItemMeta}>
                            <Text variant="small" muted>
                              {article.source} • {new Date(article.publishedAt).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Text>
                            <Badge 
                              variant="danger" 
                              style={{ 
                                backgroundColor: (() => {
                                  if (article.impact === 'high') return theme.danger;
                                  if (article.impact === 'medium') return theme.warning;
                                  return theme.success;
                                })()
                              }}
                              size="small"
                            >
                              {article.impact.toUpperCase()}
                            </Badge>
                          </View>
                        </View>
                        
                        <Text variant="body" weight="semibold" style={styles.newsItemTitle}>
                          {article.title}
                        </Text>
                        
                        <View style={styles.newsItemFooter}>
                          <View style={styles.newsCategory}>
                            <Icon 
                              name={newsService.getCategoryIcon(article.category)} 
                              size={14} 
                              color={theme.primary} 
                            />
                            <Text variant="small" color={theme.primary}>
                              {article.category.toUpperCase()}
                            </Text>
                          </View>
                          
                          {article.relatedStocks && article.relatedStocks.length > 0 && (
                            <Text variant="small" muted>
                              {article.relatedStocks.slice(0, 2).join(', ')}
                              {article.relatedStocks.length > 2 && ` +${article.relatedStocks.length - 2}`}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Show "more news" indicator when collapsed */}
                {!isNewsExpanded && topNews.length > 1 && (
                  <Pressable 
                    onPress={() => setIsNewsExpanded(true)}
                    style={styles.moreNewsButton}
                  >
                    <Text variant="small" color={theme.primary} weight="semibold">
                      +{topNews.length - 1} more news
                    </Text>
                    <Icon name="chevron-down" size={14} color={theme.primary} />
                  </Pressable>
                )}
              </>
            ) : (
              <View style={styles.newsEmptyContainer}>
                <Text variant="small" muted>No news available</Text>
              </View>
            )}
          </Card>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Pressable style={styles.statCard} onPress={() => router.push('/analytics')}>
            <Card style={styles.statCardInner}>
              <Icon name="portfolio" size={32} color={theme.primary} />
              <Text variant="small" muted style={styles.statLabel}>Portfolio Analytics</Text>
              <Text variant="h3" weight="bold">${(portfolioValue / 1000).toFixed(1)}K</Text>
            </Card>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/analytics')}>
            <Card style={styles.statCardInner}>
              <Icon name="market" size={32} color={theme.primary} />
              <Text variant="small" muted style={styles.statLabel}>Today's P&L</Text>
              <Text variant="h3" weight="bold" color={theme.primary}>+${dailyPnL}</Text>
            </Card>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/strategy-lab')}>
            <Card style={styles.statCardInner}>
              <Icon name="lab" size={32} color={theme.accent} />
              <Text variant="small" muted style={styles.statLabel}>Strategy Lab</Text>
              <Text variant="h3" weight="bold">{winRate}%</Text>
            </Card>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/(tabs)/chat')}>
            <Card style={styles.statCardInner}>
              <Icon name="leaderboard" size={32} color={theme.yellow} />
              <Text variant="small" muted style={styles.statLabel}>Rank</Text>
              <Text variant="h3" weight="bold">#{rank}</Text>
            </Card>
          </Pressable>
        </View>

        {/* Trade Signals Preview */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="signal" size={24} color={theme.accent} />
              <Text variant="h3" weight="semibold">Top Signals</Text>
            </View>
            <Pressable onPress={() => router.push('/trade-signals')}>
              <Text variant="small" color={theme.primary} weight="semibold">View All</Text>
            </Pressable>
          </View>
          
          {[
            { id: 'aapl', signal: 'AAPL - Strong Buy', variant: 'success' as const, label: 'High' },
            { id: 'tsla', signal: 'TSLA - Moderate Buy', variant: 'warning' as const, label: 'Med' },
            { id: 'btc', signal: 'BTC - Hold', variant: 'secondary' as const, label: 'Low' },
          ].map((item) => (
            <View key={item.id} style={styles.signalRow}>
              <View style={styles.signalLeft}>
                <Icon name="signal" size={16} color={theme.accent} />
                <Text variant="small">{item.signal}</Text>
              </View>
              <Badge variant={item.variant} size="small">
                {item.label}
              </Badge>
            </View>
          ))}
        </Card>

        {/* Learning Nudge */}
        <Card style={styles.card} elevation="med">
          <View style={styles.learningCard}>
            <FoxMascot variant="learning" size={100} />
            <View style={styles.learningContent}>
              <Text variant="h3" weight="semibold">Keep Learning</Text>
              <Text variant="small" muted style={styles.learningText}>
                Complete lessons to unlock advanced strategies
              </Text>
              <Button 
                variant="primary" 
                size="small"
                onPress={() => router.push('/learning-topics')}
                style={styles.learningButton}
              >
                Start Lesson
              </Button>
            </View>
          </View>
        </Card>

        {/* Bottom Spacing */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating AI Chat Button */}
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
  heroCard: {
    gap: tokens.spacing.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceAmount: {
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  card: {
    gap: tokens.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  marketNote: {
    marginTop: tokens.spacing.xs,
  },
  questList: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  questItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  questText: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  statCard: {
    width: '48%',
  },
  statCardInner: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  statLabel: {
    textAlign: 'center',
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  signalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  learningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  learningContent: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  learningText: {
    marginBottom: tokens.spacing.xs,
  },
  learningButton: {
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsContainer: {
    gap: tokens.spacing.sm,
  },
  newsItem: {
    paddingVertical: tokens.spacing.sm,
  },
  newsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  newsItemHeader: {
    marginBottom: tokens.spacing.xs,
  },
  newsItemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  newsItemTitle: {
    lineHeight: 20,
    marginBottom: tokens.spacing.xs,
  },
  newsItemSummary: {
    lineHeight: 18,
    marginBottom: tokens.spacing.sm,
  },
  newsItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newsCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  newsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  expandButton: {
    padding: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  newsLoadingContainer: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  newsEmptyContainer: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  newsPreviewItem: {
    paddingVertical: tokens.spacing.sm,
  },
  newsPreviewHeader: {
    marginBottom: tokens.spacing.xs,
  },
  newsPreviewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  newsPreviewTitle: {
    lineHeight: 20,
    marginBottom: tokens.spacing.sm,
  },
  newsPreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedNewsContainer: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  moreNewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  hideButton: {
    padding: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  showNewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
});
