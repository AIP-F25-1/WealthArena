import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Header, 
  Icon, 
  Badge,
  tokens 
} from '@/src/design-system';
import { newsService, NewsArticle } from '../../services/newsService';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'newspaper' },
  { key: 'market', label: 'Market', icon: 'trending-up' },
  { key: 'earnings', label: 'Earnings', icon: 'dollar-sign' },
  { key: 'fed', label: 'Fed', icon: 'building' },
  { key: 'crypto', label: 'Crypto', icon: 'bitcoin' },
  { key: 'forex', label: 'Forex', icon: 'globe' },
  { key: 'commodities', label: 'Commodities', icon: 'bar-chart' },
] as const;

export default function NewsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = async () => {
    try {
      setIsLoading(true);
      const newsData = await newsService.getTopNews(20);
      setNews(newsData);
      setFilteredNews(newsData);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredNews(news);
    } else {
      const filtered = news.filter(article => article.category === selectedCategory);
      setFilteredNews(filtered);
    }
  }, [selectedCategory, news]);

  const formatTimeAgo = (publishedAt: string) => {
    const now = new Date();
    const published = new Date(publishedAt);
    const diffInMinutes = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getImpactBadge = (impact: NewsArticle['impact']) => {
    const colors = {
      high: theme.danger,
      medium: theme.warning,
      low: theme.success
    };
    
    return (
      <Badge 
        variant="danger" 
        style={{ backgroundColor: colors[impact] }}
        size="small"
      >
        {impact.toUpperCase()}
      </Badge>
    );
  };

  const getSentimentIcon = (sentiment: NewsArticle['sentiment']) => {
    const icons = {
      positive: 'trending-up',
      negative: 'trending-down',
      neutral: 'remove'
    };
    
    const colors = {
      positive: theme.success,
      negative: theme.danger,
      neutral: theme.muted
    };

    return (
      <Icon 
        name={icons[sentiment]} 
        size={16} 
        color={colors[sentiment]} 
      />
    );
  };

  const renderNewsItem = (article: NewsArticle) => (
    <Pressable
      key={article.id}
      onPress={() => router.push(`/news-detail?id=${article.id}`)}
    >
      <Card style={styles.newsCard}>
        <View style={styles.newsHeader}>
          <View style={styles.newsMeta}>
            <Text variant="small" muted>
              {article.source} • {formatTimeAgo(article.publishedAt)}
            </Text>
            <View style={styles.newsBadges}>
              {getImpactBadge(article.impact)}
              {getSentimentIcon(article.sentiment)}
            </View>
          </View>
        </View>
        
        <Text variant="h4" weight="semibold" style={styles.newsTitle}>
          {article.title}
        </Text>
        
        <Text variant="body" muted style={styles.newsSummary}>
          {article.summary}
        </Text>
        
        <View style={styles.newsFooter}>
          <View style={styles.categoryTag}>
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
            <View style={styles.relatedStocks}>
              <Text variant="small" muted>
                Related: {article.relatedStocks.slice(0, 3).join(', ')}
                {article.relatedStocks.length > 3 && ` +${article.relatedStocks.length - 3} more`}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  );

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.bg }]} 
      edges={['top', 'bottom']}
    >
      {/* Custom Header with Back Button */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Icon name="newspaper" size={24} color={theme.primary} />
          <Text variant="h3" weight="bold">Trading News</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {CATEGORIES.map((category) => (
          <Pressable
            key={category.key}
            onPress={() => setSelectedCategory(category.key)}
            style={[
              styles.categoryButton,
              {
                backgroundColor: selectedCategory === category.key ? theme.primary : theme.surface,
                borderColor: selectedCategory === category.key ? theme.primary : theme.border,
              }
            ]}
          >
            <Icon 
              name={category.icon} 
              size={16} 
              color={selectedCategory === category.key ? '#FFFFFF' : theme.text} 
            />
            <Text 
              variant="small" 
              weight="medium"
              color={selectedCategory === category.key ? '#FFFFFF' : theme.text}
            >
              {category.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* News List */}
      <ScrollView
        style={styles.newsList}
        contentContainerStyle={[
          styles.newsListContent,
          { paddingBottom: Platform.OS === 'ios' ? 100 : 120 } // Extra padding to avoid nav overlap
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text variant="body" muted>Loading news...</Text>
          </View>
        ) : filteredNews.length > 0 ? (
          filteredNews.map(renderNewsItem)
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="newspaper" size={48} color={theme.muted} />
            <Text variant="h4" weight="semibold" style={styles.emptyTitle}>
              No news found
            </Text>
            <Text variant="body" muted style={styles.emptySubtitle}>
              Try selecting a different category or refresh to get the latest news.
            </Text>
            <Button
              variant="primary"
              size="medium"
              onPress={onRefresh}
              style={styles.refreshButton}
            >
              Refresh News
            </Button>
          </View>
        )}
      </ScrollView>
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
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  categoryScroll: {
    maxHeight: 60,
    marginBottom: tokens.spacing.sm,
  },
  categoryContainer: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
  },
  newsList: {
    flex: 1,
  },
  newsListContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  newsCard: {
    gap: tokens.spacing.sm,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  newsMeta: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  newsBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  newsTitle: {
    lineHeight: 24,
  },
  newsSummary: {
    lineHeight: 20,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  relatedStocks: {
    flex: 1,
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    maxWidth: 280,
  },
  refreshButton: {
    marginTop: tokens.spacing.md,
  },
});
