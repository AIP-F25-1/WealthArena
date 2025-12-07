import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
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
import { newsService, NewsArticle } from '@/services/newsService';
import { apiService } from '@/services/apiService';

interface UnifiedNewsArticle extends NewsArticle {
  source_type: 'rss' | 'market' | 'ai';
  timestamp?: string;
}

export default function NewsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [news, setNews] = useState<UnifiedNewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'rss' | 'market' | 'ai'>('all');

  // Fetch news data from multiple sources
  const fetchNews = async () => {
    try {
      setIsLoading(true);
      
      // Call all three sources in parallel
      const [rssNews, trendingData, searchResults] = await Promise.all([
        newsService.getHighImpactNews().catch(() => []),
        apiService.getTrendingMarketData(20).catch(() => ({ articles: [] })),
        apiService.searchNews('market trends', 20).catch(() => ({ results: [] }))
      ]);

      // Map RSS news
      const rssMapped: UnifiedNewsArticle[] = (rssNews || []).map((article: NewsArticle) => ({
        ...article,
        source_type: 'rss' as const,
        timestamp: article.publishedAt,
      }));

      // Map trending market data - add proper type checking
      const trendingArticles = Array.isArray(trendingData?.articles) 
        ? trendingData.articles 
        : (Array.isArray(trendingData) ? trendingData : []);
      const marketMapped: UnifiedNewsArticle[] = trendingArticles.map((item: any, index: number) => ({
        id: `market-${item.id || index}`,
        title: item.title || item.headline || 'Market Update',
        summary: item.summary || item.description || '',
        content: item.content || item.summary || '',
        source: item.source || 'Market Data',
        publishedAt: item.timestamp || item.createdAt || new Date().toISOString(),
        url: item.url || '',
        category: (item.category || 'market') as any,
        impact: (item.impact || 'medium') as any,
        sentiment: (item.sentiment || 'neutral') as any,
        source_type: 'market' as const,
        timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      }));

      // Map AI search results - add proper type checking
      const searchArticles = Array.isArray(searchResults?.results) 
        ? searchResults.results 
        : (Array.isArray(searchResults) ? searchResults : []);
      const aiMapped: UnifiedNewsArticle[] = searchArticles.map((item: any, index: number) => ({
        id: `ai-${item.id || index}`,
        title: item.title || item.headline || 'AI Insight',
        summary: item.summary || item.description || '',
        content: item.content || item.summary || '',
        source: item.source || 'AI Analysis',
        publishedAt: item.timestamp || item.createdAt || new Date().toISOString(),
        url: item.url || '',
        category: 'market' as any,
        impact: (item.impact || 'medium') as any,
        sentiment: (item.sentiment || 'neutral') as any,
        source_type: 'ai' as const,
        timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      }));

      // Combine and sort by timestamp
      const unifiedNews = [...rssMapped, ...marketMapped, ...aiMapped]
        .filter(article => article.title && article.title.trim() !== '') // Filter out empty articles
        .sort((a, b) => {
          const timeA = new Date(a.timestamp || a.publishedAt || 0).getTime();
          const timeB = new Date(b.timestamp || b.publishedAt || 0).getTime();
          return timeB - timeA; // Descending (newest first)
        });

      console.log(`[News] Loaded ${unifiedNews.length} articles (RSS: ${rssMapped.length}, Market: ${marketMapped.length}, AI: ${aiMapped.length})`);
      setNews(unifiedNews);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh news
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Market News</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text variant="h2" weight="bold">Market News</Text>
          <Text variant="body" muted>Stay updated with the latest market developments</Text>
        </View>

        {/* Source Filter */}
        <View style={styles.filterContainer}>
          <Button
            variant={sourceFilter === 'all' ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setSourceFilter('all')}
            style={styles.filterButton}
          >
            All
          </Button>
          <Button
            variant={sourceFilter === 'rss' ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setSourceFilter('rss')}
            style={styles.filterButton}
          >
            RSS
          </Button>
          <Button
            variant={sourceFilter === 'market' ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setSourceFilter('market')}
            style={styles.filterButton}
          >
            Market
          </Button>
          <Button
            variant={sourceFilter === 'ai' ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setSourceFilter('ai')}
            style={styles.filterButton}
          >
            AI
          </Button>
        </View>

        {/* Loading State */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text variant="body" muted>Loading news...</Text>
          </View>
        ) : (
          /* News List */
          <View style={styles.newsList}>
            {news
              .filter(article => sourceFilter === 'all' || article.source_type === sourceFilter)
              .map((article, index) => (
              <Card key={article.id} style={styles.newsCard}>
                <Pressable
                  onPress={() => {
                    // Handle article press - could open in browser or show details
                    console.log('Article pressed:', article.title);
                  }}
                  style={styles.newsItem}
                >
                  {/* Article Header */}
                  <View style={styles.articleHeader}>
                    <View style={styles.articleMeta}>
                      <Text variant="small" muted>
                        {article.source} • {article.source_type.toUpperCase()} • {formatTime(article.publishedAt || article.timestamp || article.publishedAt)}
                      </Text>
                      <Text variant="small" muted>
                        {formatDate(article.publishedAt)}
                      </Text>
                    </View>
                    {article.impact && (
                      <Badge 
                        variant={article.impact === 'high' ? 'danger' : 'secondary'} 
                        size="small"
                      >
                        {article.impact} impact
                      </Badge>
                    )}
                  </View>
                  
                  {/* Article Title */}
                  <Text variant="h4" weight="semibold" style={styles.articleTitle}>
                    {article.title}
                  </Text>
                  
                  {/* Article Summary */}
                  {article.summary && (
                    <Text variant="body" style={styles.articleSummary}>
                      {article.summary}
                    </Text>
                  )}
                  
                  {/* Article Footer */}
                  <View style={styles.articleFooter}>
                    <View style={styles.articleCategory}>
                      <Icon 
                        name={newsService.getCategoryIcon(article.category)} 
                        size={16} 
                        color={theme.primary} 
                      />
                      <Text variant="small" color={theme.primary} weight="medium">
                        {article.category}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={theme.muted} />
                  </View>
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && news.filter(article => sourceFilter === 'all' || article.source_type === sourceFilter).length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="newspaper" size={48} color={theme.muted} />
            <Text variant="h4" weight="semibold" style={styles.emptyTitle}>
              {news.length === 0 ? 'No News Available' : `No ${sourceFilter === 'all' ? '' : sourceFilter.toUpperCase() + ' '}News Available`}
            </Text>
            <Text variant="body" muted style={styles.emptyDescription}>
              {news.length === 0 
                ? 'Check back later for the latest market news and updates.'
                : `Try selecting a different source filter or check back later.`
              }
            </Text>
            <Button 
              variant="secondary" 
              size="medium" 
              onPress={fetchNews}
              style={styles.retryButton}
            >
              Try Again
            </Button>
            {news.length > 0 && (
              <Button 
                variant="ghost" 
                size="medium" 
                onPress={() => setSourceFilter('all')}
                style={styles.retryButton}
              >
                Show All News
              </Button>
            )}
          </View>
        )}

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
  },
  pageHeader: {
    marginBottom: tokens.spacing.lg,
    gap: tokens.spacing.xs,
  },
  loadingContainer: {
    paddingVertical: tokens.spacing.xl,
    alignItems: 'center',
  },
  newsList: {
    gap: tokens.spacing.md,
  },
  newsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  newsItem: {
    padding: tokens.spacing.md,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.sm,
  },
  articleMeta: {
    flex: 1,
    gap: 2,
  },
  articleTitle: {
    lineHeight: 24,
    marginBottom: tokens.spacing.sm,
  },
  articleSummary: {
    lineHeight: 20,
    marginBottom: tokens.spacing.md,
  },
  articleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  articleCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    marginTop: tokens.spacing.sm,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
    flexWrap: 'wrap',
  },
  filterButton: {
    minWidth: 60,
  },
});
