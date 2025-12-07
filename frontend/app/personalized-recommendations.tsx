/**
 * Personalized Recommendations Screen
 * AI-powered portfolio and strategy recommendations
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, tokens, FAB } from '@/src/design-system';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { recommendationService, PersonalizedRecommendations, PortfolioRecommendation, StrategyRecommendation, MarketInsight } from '@/services/recommendationService';

export default function PersonalizedRecommendationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { settings, updateRecommendations } = useUserSettings();
  
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolios' | 'strategies' | 'insights'>('portfolios');

  // Load recommendations on mount
  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      const recs = await recommendationService.getPersonalizedRecommendations(
        settings.riskProfile,
        { showNews: settings.showNews }
      );
      setRecommendations(recs);
      updateRecommendations(recs.portfolios);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRecommendations();
    setIsRefreshing(false);
  };

  // Helper functions for styling
  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'conservative': return theme.success;
      case 'moderate': return theme.warning;
      case 'aggressive': return theme.danger;
      case 'very_aggressive': return theme.accent;
      default: return theme.muted;
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return theme.success;
      case 'intermediate': return theme.warning;
      case 'advanced': return theme.danger;
      case 'expert': return theme.accent;
      default: return theme.muted;
    }
  };

  const renderPortfolioCard = (portfolio: PortfolioRecommendation) => (
    <Card key={portfolio.id} style={styles.recommendationCard} elevation="med">
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="briefcase" size={24} color={theme.primary} />
          <Text variant="h3" weight="semibold">{portfolio.name}</Text>
        </View>
        <Badge 
          variant={(() => {
            if (portfolio.riskLevel === 'conservative') return 'success';
            if (portfolio.riskLevel === 'moderate') return 'warning';
            return 'danger';
          })()}
          size="small"
        >
          {portfolio.riskLevel.replace('_', ' ')}
        </Badge>
      </View>

      <Text variant="body" muted style={styles.cardDescription}>
        {portfolio.description}
      </Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metric}>
          <Text variant="xs" muted>Expected Return</Text>
          <Text variant="body" weight="semibold" color={theme.success}>
            {portfolio.expectedReturn}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Volatility</Text>
          <Text variant="body" weight="semibold">
            {portfolio.expectedVolatility}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Max Drawdown</Text>
          <Text variant="body" weight="semibold" color={theme.danger}>
            {portfolio.maxDrawdown}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Sharpe Ratio</Text>
          <Text variant="body" weight="semibold">
            {portfolio.sharpeRatio}
          </Text>
        </View>
      </View>

      <View style={styles.suitabilityScore}>
        <Text variant="small" muted>Suitability Score</Text>
        <View style={styles.scoreBar}>
          <View 
            style={[
              styles.scoreFill, 
              { 
                width: `${portfolio.suitabilityScore}%`,
                backgroundColor: portfolio.suitabilityScore >= 80 ? theme.success : 
                               portfolio.suitabilityScore >= 60 ? theme.warning : theme.danger
              }
            ]} 
          />
        </View>
        <Text variant="small" weight="semibold">{portfolio.suitabilityScore}/100</Text>
      </View>

      <View style={styles.cardActions}>
        <Button
          variant="secondary"
          size="small"
          onPress={() => router.push(`/portfolio-builder?recommendation=${portfolio.id}`)}
          style={styles.actionButton}
        >
          View Details
        </Button>
        <Button
          variant="primary"
          size="small"
          onPress={() => router.push(`/portfolio-builder?recommendation=${portfolio.id}&apply=true`)}
          style={styles.actionButton}
        >
          Apply
        </Button>
      </View>
    </Card>
  );

  const renderStrategyCard = (strategy: StrategyRecommendation) => (
    <Card key={strategy.id} style={styles.recommendationCard} elevation="med">
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="trending-up" size={24} color={theme.accent} />
          <Text variant="h3" weight="semibold">{strategy.name}</Text>
        </View>
        <Badge 
          variant={(() => {
            if (strategy.difficulty === 'beginner') return 'success';
            if (strategy.difficulty === 'intermediate') return 'warning';
            return 'danger';
          })()}
          size="small"
        >
          {strategy.difficulty}
        </Badge>
      </View>

      <Text variant="body" muted style={styles.cardDescription}>
        {strategy.description}
      </Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metric}>
          <Text variant="xs" muted>Expected Return</Text>
          <Text variant="body" weight="semibold" color={theme.success}>
            {strategy.expectedReturn}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Win Rate</Text>
          <Text variant="body" weight="semibold" color={theme.primary}>
            {strategy.winRate}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Max Drawdown</Text>
          <Text variant="body" weight="semibold" color={theme.danger}>
            {strategy.maxDrawdown}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Time Commitment</Text>
          <Text variant="body" weight="semibold">
            {strategy.timeCommitment}
          </Text>
        </View>
      </View>

      <View style={styles.indicatorsSection}>
        <Text variant="small" muted>Key Indicators</Text>
        <View style={styles.indicatorsList}>
          {strategy.indicators.map((indicator) => (
            <Badge key={indicator} variant="secondary" size="small">
              {indicator}
            </Badge>
          ))}
        </View>
      </View>

      <View style={styles.cardActions}>
        <Button
          variant="secondary"
          size="small"
          onPress={() => router.push(`/strategy-detail?id=${strategy.id}`)}
          style={styles.actionButton}
        >
          Learn More
        </Button>
        <Button
          variant="primary"
          size="small"
          onPress={() => router.push('/trade-simulator')}
          style={styles.actionButton}
        >
          Practice
        </Button>
      </View>
    </Card>
  );

  const renderInsightCard = (insight: MarketInsight) => (
    <Card key={insight.id} style={styles.recommendationCard} elevation="med">
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="bulb" size={24} color={theme.yellow} />
          <Text variant="h3" weight="semibold">{insight.title}</Text>
        </View>
        <Badge 
          variant={(() => {
            if (insight.impact === 'high') return 'danger';
            if (insight.impact === 'medium') return 'warning';
            return 'success';
          })()}
          size="small"
        >
          {insight.impact} impact
        </Badge>
      </View>

      <Text variant="body" muted style={styles.cardDescription}>
        {insight.description}
      </Text>

      <View style={styles.insightMetrics}>
        <View style={styles.metric}>
          <Text variant="xs" muted>Confidence</Text>
          <Text variant="body" weight="semibold">
            {Math.round(insight.confidence * 100)}%
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Timeframe</Text>
          <Text variant="body" weight="semibold">
            {insight.timeframe}-term
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Recommendation</Text>
          <Badge 
            variant={(() => {
              if (insight.recommendation === 'buy') return 'success';
              if (insight.recommendation === 'sell') return 'danger';
              return 'warning';
            })()}
            size="small"
          >
            {insight.recommendation.toUpperCase()}
          </Badge>
        </View>
      </View>

      <View style={styles.relatedAssets}>
        <Text variant="small" muted>Related Assets</Text>
        <View style={styles.assetsList}>
          {insight.relatedAssets.map((asset) => (
            <Badge key={asset} variant="secondary" size="small">
              {asset}
            </Badge>
          ))}
        </View>
      </View>

      <View style={styles.cardActions}>
        <Button
          variant="secondary"
          size="small"
          onPress={() => router.push(`/search-instruments?q=${insight.relatedAssets[0]}`)}
          style={styles.actionButton}
        >
          View Assets
        </Button>
        <Button
          variant="primary"
          size="small"
          onPress={() => router.push('/trade-signals')}
          style={styles.actionButton}
        >
          Trade Signals
        </Button>
      </View>
    </Card>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Ionicons name="analytics" size={64} color={theme.primary} />
          <Text variant="h3" weight="bold">Loading Recommendations...</Text>
          <Text variant="body" muted center>
            Analyzing your risk profile and market conditions
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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>AI Recommendations</Text>
        <Pressable onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header Card */}
        <Card style={styles.headerCard} elevation="med" noBorder>
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Ionicons name="sparkles" size={48} color={theme.bg} />
              <Text variant="h1" weight="bold" style={[styles.headerTitle, { color: theme.bg }]}>
                Personalized Recommendations
              </Text>
              <Text variant="body" style={[styles.headerSubtitle, { color: theme.bg + 'CC' }]}>
                AI-powered insights tailored to your risk profile
              </Text>
            </View>
          </LinearGradient>
        </Card>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab('portfolios')}
            style={[
              styles.tab,
              activeTab === 'portfolios' && { backgroundColor: theme.primary }
            ]}
          >
            <Ionicons 
              name="briefcase" 
              size={20} 
              color={activeTab === 'portfolios' ? theme.bg : theme.text} 
            />
            <Text 
              variant="small" 
              weight="semibold" 
              color={activeTab === 'portfolios' ? theme.bg : theme.text}
            >
              Portfolios
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('strategies')}
            style={[
              styles.tab,
              activeTab === 'strategies' && { backgroundColor: theme.primary }
            ]}
          >
            <Ionicons 
              name="trending-up" 
              size={20} 
              color={activeTab === 'strategies' ? theme.bg : theme.text} 
            />
            <Text 
              variant="small" 
              weight="semibold" 
              color={activeTab === 'strategies' ? theme.bg : theme.text}
            >
              Strategies
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('insights')}
            style={[
              styles.tab,
              activeTab === 'insights' && { backgroundColor: theme.primary }
            ]}
          >
            <Ionicons 
              name="bulb" 
              size={20} 
              color={activeTab === 'insights' ? theme.bg : theme.text} 
            />
            <Text 
              variant="small" 
              weight="semibold" 
              color={activeTab === 'insights' ? theme.bg : theme.text}
            >
              Insights
            </Text>
          </Pressable>
        </View>

        {/* Content based on active tab */}
        {activeTab === 'portfolios' && recommendations?.portfolios.map(renderPortfolioCard)}
        {activeTab === 'strategies' && recommendations?.strategies.map(renderStrategyCard)}
        {activeTab === 'insights' && recommendations?.marketInsights.map(renderInsightCard)}

        {/* Last Updated */}
        {recommendations && (
          <Card style={styles.footerCard}>
            <Text variant="xs" muted center>
              Last updated: {new Date(recommendations.lastUpdated).toLocaleString()}
            </Text>
            <Text variant="xs" muted center>
              Next update: {new Date(recommendations.nextUpdate).toLocaleString()}
            </Text>
          </Card>
        )}

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
  refreshButton: {
    padding: tokens.spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
  },
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {
    marginBottom: tokens.spacing.md,
  },
  headerGradient: {
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
  },
  headerContent: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  headerTitleText: {
    textAlign: 'center',
  },
  headerSubtitle: {
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.xs,
    marginBottom: tokens.spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.sm,
  },
  recommendationCard: {
    gap: tokens.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  cardDescription: {
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  metric: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: tokens.radius.sm,
  },
  suitabilityScore: {
    gap: tokens.spacing.xs,
  },
  scoreBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  indicatorsSection: {
    gap: tokens.spacing.xs,
  },
  indicatorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  insightMetrics: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  relatedAssets: {
    gap: tokens.spacing.xs,
  },
  assetsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flex: 1,
  },
  footerCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.lg,
  },
});
