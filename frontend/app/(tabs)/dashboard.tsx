import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal, Animated, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { alphaVantageService, AlphaVantageCandleData } from '../../services/alphaVantageService';
import { newsService, NewsArticle } from '../../services/newsService';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { useUser } from '@/contexts/UserContext';
import { useGamification } from '@/contexts/GamificationContext';
import { useLeaderboard } from '@/contexts/LeaderboardContext';
import CharacterMascot from '@/components/CharacterMascot';
import { apiService } from '@/services/apiService';
import { resolveBackendURL } from '@/utils/networkConfig';
import { getAuthHeaders } from '@/services/apiService';

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [marketData, setMarketData] = useState<AlphaVantageCandleData[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [topNews, setTopNews] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isNewsExpanded, setIsNewsExpanded] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [topSignals, setTopSignals] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { settings } = useUserSettings();
  const { user, userRank: userContextRank } = useUser();
  const { currentXP, currentCoins, currentLevel, levelProgress, activeQuests } = useGamification();
  const { userRank: leaderboardRank, globalLeaderboard } = useLeaderboard();
  const showNewsPreview = settings.showNews;

  // Real user data from contexts
  const displayName = user?.full_name || user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Trader';
  const portfolioValue = portfolioData?.total_value || user?.total_balance || 100000; // Default starting balance
  const dailyPnL = portfolioData?.daily_pnl || 0;
  const winRate = user?.win_rate || 0;
  // Use leaderboard rank if available, otherwise fall back to UserContext rank, then user.rank, or null for new users
  const rank = leaderboardRank?.rank || userContextRank || user?.rank || null;
  const dailyQuestProgress = activeQuests.length > 0 ? Math.round((activeQuests.filter(q => q.isCompleted).length / activeQuests.length) * 100) : 0;
  
  // Check if user is first-time user
  useEffect(() => {
    const checkFirstTimeUser = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
        
        if (!hasSeenWelcome && hasCompletedOnboarding) {
          setIsFirstTimeUser(true);
          setShowWelcomeModal(true);
          await AsyncStorage.setItem('hasSeenWelcome', 'true');
        }
      } catch (error) {
        console.error('Failed to check first-time user status:', error);
      }
    };

    checkFirstTimeUser();
  }, []);

  // Fetch real market data - Database first, then fallbacks
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setIsLoadingMarket(true);
        
        // PRIMARY: Try database first (from data-pipeline)
        // Get first available symbol from dataset instead of hardcoded SPY
        try {
          const backendUrl = await resolveBackendURL(3000);
          
          // First, get available symbols
          const symbolsResponse = await fetch(
            `${backendUrl}/api/market-data/available-symbols`,
            {
              headers: await getAuthHeaders(),
            }
          );
          
          let symbolToUse = 'SPY'; // Default fallback
          if (symbolsResponse.ok) {
            const symbolsData = await symbolsResponse.json();
            if (symbolsData.success && symbolsData.data && symbolsData.data.length > 0) {
              // Use first available symbol (prefer stocks, then others)
              const stocks = symbolsData.data.filter((s: string) => !s.includes('=') && !s.includes('-USD'));
              symbolToUse = stocks.length > 0 ? stocks[0] : symbolsData.data[0];
              console.log(`Using symbol from dataset: ${symbolToUse}`);
            }
          }
          
          const response = await fetch(
            `${backendUrl}/api/market-data/history/${symbolToUse}?period=1mo`,
            {
              headers: await getAuthHeaders(),
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              const data = result.data.map((candle: any) => ({
                time: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
              }));
              setMarketData(data);
              return;
            }
          }
        } catch (dbError) {
          console.warn('Database fetch failed, trying fallbacks...', dbError);
          // Don't crash - continue to fallbacks
        }
        
        // FALLBACK 1: Try Alpha Vantage
        try {
          const data = await alphaVantageService.getSP500Data();
          if (data && data.length > 0) {
            setMarketData(data);
            return;
          }
        } catch (avError) {
          console.warn('Alpha Vantage failed, trying chatbot API...');
        }
        
        // FALLBACK 2: Try chatbot market API (uses yfinance)
        // Get available symbol from dataset instead of hardcoded SPY
        try {
          const chatbotUrl = process.env.EXPO_PUBLIC_CHATBOT_URL || 'http://localhost:8000';
          const backendUrl = await resolveBackendURL(3000);
          let symbolToUse = 'SPY'; // Default fallback
          try {
            const symbolsResponse = await fetch(
              `${backendUrl}/api/market-data/available-symbols`,
              {
                headers: await getAuthHeaders(),
              }
            );
            if (symbolsResponse.ok) {
              const symbolsData = await symbolsResponse.json();
              if (symbolsData.success && symbolsData.data && symbolsData.data.length > 0) {
                const stocks = symbolsData.data.filter((s: string) => !s.includes('=') && !s.includes('-USD'));
                symbolToUse = stocks.length > 0 ? stocks[0] : symbolsData.data[0];
              }
            }
          } catch (e) {
            // Use default if symbol fetch fails
          }
          
          const response = await fetch(
            `${chatbotUrl}/v1/market/ohlc?symbol=${symbolToUse}&period=1mo&interval=1d`
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
              setMarketData(data);
              return;
            }
          }
        } catch (chatbotError) {
          console.warn('Chatbot API also failed:', chatbotError);
        }
        
        // If all sources fail, show empty state
        setMarketData([]);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        setMarketData([]);
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

  // Load dashboard data from APIs
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoadingData(true);
        
        // Load portfolio data
        const portfolioResponse = await apiService.getPortfolio();
        if (portfolioResponse.success && portfolioResponse.data) {
          setPortfolioData(portfolioResponse.data);
        }
        
        // Load top signals
        const signalsResponse = await apiService.getTopSignals(null, 3);
        if (signalsResponse.success) {
          setTopSignals(signalsResponse.data || []);
        }
        
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (user?.user_id) {
      loadDashboardData();
    }
  }, [user?.user_id]);
  
  // Market candlestick data (S&P 500) - 30 days for daily chart
  // Removed marketCandleData fallback - use marketData directly with empty state handling

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

  // Compute week-over-week change from market data
  const weekOverWeekChange = useMemo(() => {
    if (!marketData || marketData.length < 5) {
      return null; // Not enough data to compute week-over-week change
    }
    
    // Get the latest close price
    const latest = marketData[marketData.length - 1];
    const latestClose = latest.close;
    
    // Get the close price from approximately 7 days ago (or as close as we have)
    // We need at least 5 candles to have a reasonable week-over-week calculation
    const weekAgoIndex = Math.max(0, marketData.length - 7);
    const weekAgo = marketData[weekAgoIndex];
    const weekAgoClose = weekAgo.close;
    
    if (!latestClose || !weekAgoClose || weekAgoClose === 0) {
      return null;
    }
    
    const change = latestClose - weekAgoClose;
    const changePercent = (change / weekAgoClose) * 100;
    
    return {
      change,
      changePercent,
      isPositive: change >= 0
    };
  }, [marketData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header with XP/Coins */}
      <Header 
        greeting={greeting}
        userName={displayName} 
        showNotifications 
        lastUpdated={lastUpdated}
        marketStatus={marketStatus}
        rightContent={
          <View style={styles.headerStats}>
            <View style={styles.xpBadge}>
              <Icon name="star" size={16} color={theme.yellow} />
              <Text variant="small" weight="semibold" style={{ color: theme.yellow }}>
                {currentXP}
              </Text>
            </View>
            <View style={styles.coinsBadge}>
              <Icon name="coin" size={16} color={theme.accent} />
              <Text variant="small" weight="semibold" style={{ color: theme.accent }}>
                {currentCoins}
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text variant="small" weight="semibold" style={{ color: theme.primary }}>
                Lv.{currentLevel}
              </Text>
            </View>
          </View>
        }
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingData}
            onRefresh={async () => {
              try {
                setIsLoadingData(true);
                const [portfolioResponse, signalsResponse] = await Promise.all([
                  apiService.getPortfolio(),
                  apiService.getTopSignals(null, 3),
                ]);
                if (portfolioResponse.success && portfolioResponse.data) {
                  setPortfolioData(portfolioResponse.data);
                }
                if (signalsResponse.success) {
                  setTopSignals(signalsResponse.data || []);
                }
              } catch (error) {
                console.error('Failed to refresh dashboard:', error);
              } finally {
                setIsLoadingData(false);
              }
            }}
            tintColor={theme.primary}
          />
        }
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
                <Icon name="market" size={16} color={dailyPnL >= 0 ? theme.success : theme.danger} />
                <Text variant="small" color={dailyPnL >= 0 ? theme.success : theme.danger} weight="semibold">
                  {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)} Today
                </Text>
              </View>
            </View>
            <FoxMascot variant="excited" size={80} contextual context="dashboard" />
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
          ) : marketData.length > 0 ? (
            <CandlestickChart 
              data={marketData.map(candle => ({
                time: 'time' in candle ? candle.time : candle.timestamp,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
              }))} 
              chartType="daily"
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Text variant="small" muted center>Market data unavailable</Text>
              <Text variant="xs" muted center style={{ marginTop: tokens.spacing.xs }}>
                Unable to fetch live market data. Please check your connection.
              </Text>
            </View>
          )}
          {weekOverWeekChange && (
            <Text variant="small" muted style={styles.marketNote}>
              S&P 500 {weekOverWeekChange.isPositive ? 'up' : 'down'} {Math.abs(weekOverWeekChange.changePercent).toFixed(1)}% this week
            </Text>
          )}
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
              <Icon name="market" size={32} color={dailyPnL >= 0 ? theme.success : theme.danger} />
              <Text variant="small" muted style={styles.statLabel}>Today's P&L</Text>
              <Text variant="h3" weight="bold" color={dailyPnL >= 0 ? theme.success : theme.danger}>
                {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}
              </Text>
            </Card>
          </Pressable>

          <Pressable style={styles.statCard} onPress={() => router.push('/strategy-lab')}>
            <Card style={styles.statCardInner}>
              <Icon name="lab" size={32} color={winRate >= 70 ? theme.success : winRate >= 50 ? theme.warning : theme.danger} />
              <Text variant="small" muted style={styles.statLabel}>Win Rate</Text>
              <Text variant="h3" weight="bold">{winRate ? `${winRate.toFixed(1)}%` : '--'}</Text>
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
          
          {isLoadingData ? (
            <View style={styles.loadingContainer}>
              <Text variant="small" muted>Loading signals...</Text>
            </View>
          ) : topSignals.length > 0 ? (
            topSignals.map((signal: any) => (
              <View key={signal.id || signal.symbol} style={styles.signalRow}>
                <View style={styles.signalLeft}>
                  <Icon name="signal" size={16} color={theme.accent} />
                  <Text variant="small">
                    {signal.symbol} - {signal.signal_type || 'Signal'}
                  </Text>
                </View>
                <Badge 
                  variant={signal.confidence_score && signal.confidence_score >= 0.7 ? 'success' : 
                          signal.confidence_score && signal.confidence_score >= 0.5 ? 'warning' : 'secondary'} 
                  size="small"
                >
                  {signal.confidence_score ? `${(signal.confidence_score * 100).toFixed(0)}%` : '--'}
                </Badge>
              </View>
            ))
          ) : (
            <View style={styles.loadingContainer}>
              <Text variant="small" muted>No signals available</Text>
            </View>
          )}
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

      {/* Welcome Modal for First-Time Users */}
      <Modal
        visible={showWelcomeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWelcomeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.welcomeModal}>
            <View style={styles.welcomeHeader}>
              <CharacterMascot character="excited" size={60} />
              <Text variant="h2" style={styles.welcomeTitle}>
                Welcome to WealthArena!
              </Text>
              <Text variant="body" style={styles.welcomeSubtitle}>
                Hi {displayName}! Your trading journey starts now. Here's what you can do:
              </Text>
            </View>

            <View style={styles.welcomeActions}>
              <Button
                variant="primary"
                size="large"
                onPress={() => {
                  setShowWelcomeModal(false);
                  router.push('/learning-topics');
                }}
                fullWidth
                style={styles.welcomeActionButton}
              >
                📚 Start Learning
              </Button>
              
              <Button
                variant="secondary"
                size="large"
                onPress={() => {
                  setShowWelcomeModal(false);
                  router.push('/game-play');
                }}
                fullWidth
                style={styles.welcomeActionButton}
              >
                🎮 Try Trading Game
              </Button>
              
              <Button
                variant="secondary"
                size="large"
                onPress={() => {
                  setShowWelcomeModal(false);
                  router.push('/daily-quests');
                }}
                fullWidth
                style={styles.welcomeActionButton}
              >
                ⭐ Complete Daily Quests
              </Button>
            </View>

            <Button
              variant="ghost"
              size="medium"
              onPress={() => setShowWelcomeModal(false)}
              style={styles.skipWelcomeButton}
            >
              I'll explore on my own
            </Button>
          </View>
        </View>
      </Modal>
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

  // Welcome Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  welcomeModal: {
    backgroundColor: tokens.color.white,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  welcomeHeader: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  welcomeTitle: {
    color: tokens.color.primary,
    textAlign: 'center',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  welcomeSubtitle: {
    color: tokens.color.neutral500,
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeActions: {
    width: '100%',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  welcomeActionButton: {
    marginBottom: tokens.spacing.sm,
  },
  skipWelcomeButton: {
    alignSelf: 'center',
  },

  // Header Stats Styles
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
  },
  coinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: 'rgba(52, 144, 220, 0.1)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
  },
  levelBadge: {
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
  },
  levelProgressContainer: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
