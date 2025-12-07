/**
 * Portfolio Builder - Advanced Portfolio Management
 * Intuitive interface for creating and managing investment portfolios
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, tokens, FAB, TextInput } from '@/src/design-system';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { assetService, TradingAsset } from '@/services/assetService';
import { recommendationService } from '@/services/recommendationService';
import { 
  getPortfolio, 
  getPositions, 
  getTrades, 
  createPortfolio, 
  updatePortfolio, 
  deletePortfolio as apiDeletePortfolio, 
  getPortfolioPerformance 
} from '@/services/apiService';

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
  assets: PortfolioAsset[];
  totalValue: number;
  createdAt: Date;
  lastModified: Date;
}

interface PortfolioAsset {
  asset: TradingAsset;
  allocation: number; // percentage
  quantity: number;
  value: number;
}

export default function PortfolioBuilderScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { settings } = useUserSettings();
  
  // State management
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentPortfolio, setCurrentPortfolio] = useState<Portfolio | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'create' | 'edit' | 'analyze'>('overview');
  const [selectedAssets, setSelectedAssets] = useState<TradingAsset[]>([]);
  const [availableAssets, setAvailableAssets] = useState<TradingAsset[]>([]);
  const [assetType, setAssetType] = useState<string>('all');
  const [riskLevel, setRiskLevel] = useState<'Conservative' | 'Moderate' | 'Aggressive'>('Moderate');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [totalAllocation, setTotalAllocation] = useState(0);
  const [positions, setPositions] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadPortfolios();
    loadAssets();
    loadRecommendations();
    loadPositions();
    loadTrades();
  }, []);

  const loadPositions = async () => {
    try {
      const response = await getPositions();
      setPositions(response.data || []);
    } catch (error) {
      console.error('Error loading positions:', error);
      setPositions([]);
    }
  };

  const loadTrades = async () => {
    try {
      const response = await getTrades();
      setTrades(response.data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
      setTrades([]);
    }
  };

  // Update risk level based on user settings
  useEffect(() => {
    const userRiskLevel = settings.riskProfile.riskTolerance;
    if (userRiskLevel === 'conservative') setRiskLevel('Conservative');
    else if (userRiskLevel === 'moderate') setRiskLevel('Moderate');
    else if (userRiskLevel === 'aggressive' || userRiskLevel === 'very_aggressive') setRiskLevel('Aggressive');
  }, [settings.riskProfile.riskTolerance]);

  // Load performance data when in analyze mode
  useEffect(() => {
    if (viewMode === 'analyze' && currentPortfolio) {
      const loadPerformance = async () => {
        try {
          const response = await getPortfolioPerformance(currentPortfolio.id);
          setPerformanceData(response);
        } catch (error) {
          console.error('Error loading performance data:', error);
          setPerformanceData(null);
        }
      };
      loadPerformance();
    }
  }, [viewMode, currentPortfolio]);

  const loadPortfolios = async () => {
    setIsLoadingData(true);
    try {
      const response = await getPortfolio();
      // The API returns a single portfolio object, convert to array if needed
      if (response && response.PortfolioID) {
        const portfolio: Portfolio = {
          id: response.PortfolioID?.toString() || '1',
          name: response.PortfolioName || 'My Portfolio',
          totalValue: response.TotalValue || 0,
          createdAt: response.LastUpdated ? new Date(response.LastUpdated) : new Date(),
          lastModified: response.LastUpdated ? new Date(response.LastUpdated) : new Date(),
        };
        setPortfolios([portfolio]);
      } else {
        setPortfolios([]);
      }
    } catch (error) {
      console.error('Error loading portfolios:', error);
      setPortfolios([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadAssets = async () => {
    try {
      // Use cached asset service to fetch from database
      const { cachedAssetService } = await import('@/services/cachedAssetService');
      const assets = await cachedAssetService.getAssets(
        assetType === 'all' ? {} : { type: assetType }
      );
      setAvailableAssets(assets);
    } catch (error) {
      console.error('Error loading assets:', error);
      // Fallback to assetService if cached service fails
      try {
        const assets = await assetService.getAssets(
          assetType === 'all' ? {} : { type: assetType }
        );
        setAvailableAssets(assets);
      } catch (fallbackError) {
        console.error('Fallback asset loading also failed:', fallbackError);
      }
    }
  };

  const loadRecommendations = async () => {
    try {
      const recs = await recommendationService.getPortfolioRecommendations(
        settings.riskProfile.riskTolerance,
        10000 // Default investment amount
      );
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const createNewPortfolio = () => {
    setCurrentPortfolio(null);
    setPortfolioName('');
    setPortfolioDescription('');
    setSelectedAssets([]);
    setAllocations({});
    setTotalAllocation(0);
    setViewMode('create');
  };

  const editPortfolio = (portfolio: Portfolio) => {
    setCurrentPortfolio(portfolio);
    setPortfolioName(portfolio.name);
    setPortfolioDescription(portfolio.description || '');
    setRiskLevel(portfolio.riskLevel);
    setViewMode('edit');
  };

  const savePortfolio = async () => {
    if (!portfolioName.trim()) {
      Alert.alert('Error', 'Please enter a portfolio name');
      return;
    }

    if (selectedAssets.length === 0) {
      Alert.alert('Error', 'Please select at least one asset');
      return;
    }

    if (totalAllocation !== 100) {
      Alert.alert('Error', 'Total allocation must equal 100%');
      return;
    }

    try {
      const portfolioData = {
        name: portfolioName.trim(),
        description: portfolioDescription.trim(),
        riskLevel,
        assets: selectedAssets.map(asset => ({
          symbol: asset.symbol,
          allocation: allocations[asset.id] || 0,
          currentPrice: asset.price || 100,
        })),
        initialCapital: 100000, // Default initial capital
      };

      let result;
      if (currentPortfolio) {
        result = await updatePortfolio(currentPortfolio.id, portfolioData);
      } else {
        result = await createPortfolio(portfolioData);
      }

      await loadPortfolios();
      setViewMode('overview');
      Alert.alert('Success', `Portfolio "${portfolioName}" saved successfully!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save portfolio');
    }
  };

  const deletePortfolio = (portfolioId: string) => {
    Alert.alert(
      'Delete Portfolio',
      'Are you sure you want to delete this portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeletePortfolio(portfolioId);
              await loadPortfolios();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete portfolio');
            }
          }
        }
      ]
    );
  };

  const toggleAsset = (asset: TradingAsset) => {
    if (selectedAssets.some(a => a.id === asset.id)) {
      setSelectedAssets(prev => prev.filter(a => a.id !== asset.id));
      setAllocations(prev => {
        const newAllocations = { ...prev };
        delete newAllocations[asset.id];
        return newAllocations;
      });
    } else {
      setSelectedAssets(prev => [...prev, asset]);
    }
  };

  const updateAllocation = (assetId: string, value: number) => {
    setAllocations(prev => {
      const newAllocations = { ...prev, [assetId]: value };
      const total = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
      setTotalAllocation(total);
      return newAllocations;
    });
  };

  const autoAllocate = () => {
    if (selectedAssets.length === 0) return;
    
    const equalAllocation = 100 / selectedAssets.length;
    const newAllocations: Record<string, number> = {};
    
    selectedAssets.forEach(asset => {
      newAllocations[asset.id] = Math.round(equalAllocation * 100) / 100;
    });
    
    setAllocations(newAllocations);
    setTotalAllocation(100);
  };

  const applyRecommendation = (recommendation: any) => {
    setPortfolioName(recommendation.name);
    setPortfolioDescription(recommendation.description);
    setRiskLevel(recommendation.riskLevel);
    
    // Convert recommendation assets to selected assets
    const recAssets: TradingAsset[] = recommendation.assets.map((asset: any) => ({
      id: asset.symbol,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.assetType,
      price: 100, // Mock price
      change: 0,
      changePercent: 0,
    }));
    
    setSelectedAssets(recAssets);
    
    // Set allocations
    const newAllocations: Record<string, number> = {};
    recommendation.assets.forEach((asset: any) => {
      newAllocations[asset.symbol] = asset.allocation;
    });
    
    setAllocations(newAllocations);
    setTotalAllocation(100);
    setViewMode('create');
    
    Alert.alert('Recommendation Applied', 'Portfolio template has been applied. You can modify it as needed.');
  };

  const renderOverview = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card style={styles.headerCard} elevation="med" noBorder>
        <LinearGradient
          colors={[theme.primary, theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Ionicons name="briefcase" size={48} color={theme.bg} />
            <Text variant="h1" weight="bold" style={[styles.headerTitle, { color: theme.bg }]}>
              Portfolio Manager
            </Text>
            <Text variant="body" style={[styles.headerSubtitle, { color: theme.bg + 'CC' }]}>
              Create, manage, and analyze your investment portfolios
            </Text>
          </View>
        </LinearGradient>
      </Card>

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <Card style={styles.recommendationsCard}>
            <View style={styles.recommendationsHeader}>
              <View style={styles.recommendationsTitleRow}>
                <Ionicons name="sparkles" size={24} color={theme.accent} />
                <Text variant="h3" weight="semibold">AI Recommendations</Text>
              </View>
              <Pressable onPress={() => setShowRecommendations(!showRecommendations)}>
                <Text variant="small" color={theme.primary} weight="semibold">
                  {showRecommendations ? 'Hide' : 'Show All'}
                </Text>
              </Pressable>
            </View>
            
            <Text variant="body" muted style={styles.recommendationsDescription}>
              Personalized portfolio suggestions based on your risk profile
            </Text>

            {showRecommendations ? (
              <View style={styles.recommendationsList}>
                {recommendations.slice(0, 2).map((rec) => (
                  <Pressable 
                    key={rec.id}
                    onPress={() => applyRecommendation(rec)}
                    style={styles.recommendationItem}
                  >
                    <View style={styles.recommendationContent}>
                      <Text variant="body" weight="semibold">{rec.name}</Text>
                      <Text variant="small" muted>{rec.description}</Text>
                      <View style={styles.recommendationMetrics}>
                        <Text variant="xs" muted>Expected Return: </Text>
                        <Text variant="xs" weight="semibold" color={theme.success}>
                          {rec.expectedReturn}%
                        </Text>
                        <Text variant="xs" muted>Risk: </Text>
                        <Text variant="xs" weight="semibold">
                          {rec.expectedVolatility}%
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.muted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Button
                variant="secondary"
                size="medium"
                onPress={() => router.push('/personalized-recommendations' as any)}
                icon={<Ionicons name="sparkles" size={16} color={theme.primary} />}
                fullWidth
              >
                View All Recommendations
              </Button>
            )}
          </Card>
        )}

        {/* Quick Actions */}
        <Card style={styles.quickActionsCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable onPress={createNewPortfolio} style={styles.quickActionButton}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="add-circle" size={32} color={theme.primary} />
              </View>
              <Text variant="body" weight="semibold" center>Create New</Text>
              <Text variant="xs" muted center>Start from scratch</Text>
            </Pressable>
            
            <Pressable onPress={() => setViewMode('analyze')} style={styles.quickActionButton}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.accent + '20' }]}>
                <Ionicons name="analytics" size={32} color={theme.accent} />
              </View>
              <Text variant="body" weight="semibold" center>Analyze</Text>
              <Text variant="xs" muted center>View performance</Text>
            </Pressable>
          </View>
        </Card>

      {/* Portfolios List */}
      <Card style={styles.portfoliosCard}>
        <View style={styles.sectionHeader}>
          <Text variant="h3" weight="semibold">Your Portfolios</Text>
          <Badge variant="primary" size="small">{portfolios.length}</Badge>
        </View>
        
        {portfolios.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={theme.muted} />
            <Text variant="h3" weight="semibold" center style={styles.emptyTitle}>
              No Portfolios Yet
            </Text>
            <Text variant="body" muted center style={styles.emptyDescription}>
              Create your first portfolio to start managing your investments
            </Text>
            <Button
              variant="primary"
              size="large"
              onPress={createNewPortfolio}
              icon={<Ionicons name="add" size={20} color={theme.bg} />}
              style={styles.emptyActionButton}
            >
              Create Portfolio
            </Button>
          </View>
        ) : (
          <View style={styles.portfoliosList}>
            {portfolios.map((portfolio) => (
              <Card key={portfolio.id} style={styles.portfolioItem}>
                <View style={styles.portfolioHeader}>
                  <View style={styles.portfolioInfo}>
                    <Text variant="h3" weight="semibold">{portfolio.name}</Text>
                    <Text variant="small" muted>{portfolio.description}</Text>
                  </View>
                  <View style={styles.portfolioActions}>
                    <Pressable onPress={() => editPortfolio(portfolio)} style={styles.actionButton}>
                      <Ionicons name="create" size={20} color={theme.primary} />
                    </Pressable>
                    <Pressable onPress={() => deletePortfolio(portfolio.id)} style={styles.actionButton}>
                      <Ionicons name="trash" size={20} color={theme.danger} />
                    </Pressable>
                  </View>
                </View>
                
                <View style={styles.portfolioStats}>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Risk Level</Text>
                    <Badge 
                      variant={portfolio.riskLevel === 'Conservative' ? 'success' : 
                              portfolio.riskLevel === 'Moderate' ? 'warning' : 'danger'}
                      size="small"
                    >
                      {portfolio.riskLevel}
                    </Badge>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Total Value</Text>
                    <Text variant="body" weight="semibold">${portfolio.totalValue.toLocaleString()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Assets</Text>
                    <Text variant="body" weight="semibold">{portfolio.assets.length}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Card>

      {/* Portfolio Positions */}
      <Card style={styles.portfoliosCard}>
        <View style={styles.sectionHeader}>
          <Text variant="h3" weight="semibold">Portfolio Positions</Text>
          <Badge variant="primary" size="small">{positions.length}</Badge>
        </View>
        
        {isLoadingData ? (
          <Text variant="small" muted center style={{ paddingVertical: tokens.spacing.md }}>
            Loading positions...
          </Text>
        ) : positions.length === 0 ? (
          <Text variant="small" muted center style={{ paddingVertical: tokens.spacing.md }}>
            No open positions
          </Text>
        ) : (
          <View style={styles.positionsList}>
            {positions.map((position, index) => (
              <View key={position.id || `pos-${index}`} style={styles.positionRow}>
                <View style={styles.positionHeader}>
                  <Text variant="body" weight="bold">{position.symbol}</Text>
                  <Text variant="small" weight="semibold">Qty: {position.quantity?.toFixed(2)}</Text>
                </View>
                <View style={styles.positionDetails}>
                  <View style={styles.positionMetric}>
                    <Text variant="xs" muted>Entry Price</Text>
                    <Text variant="small">${position.average_price?.toFixed(2) || 'N/A'}</Text>
                  </View>
                  <View style={styles.positionMetric}>
                    <Text variant="xs" muted>Current Price</Text>
                    <Text variant="small">${position.current_price?.toFixed(2) || 'N/A'}</Text>
                  </View>
                  <View style={styles.positionMetric}>
                    <Text variant="xs" muted>Unrealized P&L</Text>
                    <Text 
                      variant="small" 
                      weight="semibold"
                      color={position.unrealized_pnl > 0 ? theme.success : 
                             position.unrealized_pnl < 0 ? theme.danger : theme.muted}
                    >
                      ${position.unrealized_pnl?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Trade History */}
      <Card style={styles.portfoliosCard}>
        <View style={styles.sectionHeader}>
          <Text variant="h3" weight="semibold">Trade History</Text>
          <Badge variant="primary" size="small">{trades.length}</Badge>
        </View>
        
        {isLoadingData ? (
          <Text variant="small" muted center style={{ paddingVertical: tokens.spacing.md }}>
            Loading trades...
          </Text>
        ) : trades.length === 0 ? (
          <Text variant="small" muted center style={{ paddingVertical: tokens.spacing.md }}>
            No trade history
          </Text>
        ) : (
          <>
            <View style={styles.tradesList}>
              {trades.map((trade, index) => (
                <View key={trade.id || `trade-${index}`} style={styles.tradeRow}>
                  <View style={styles.tradeHeader}>
                    <View>
                      <Text variant="body" weight="bold">{trade.symbol}</Text>
                      <Text variant="xs" muted>
                        {new Date(trade.trade_date).toLocaleDateString()}
                      </Text>
                    </View>
                    <Badge variant={trade.trade_type === 'BUY' ? 'success' : 'danger'} size="small">
                      {trade.trade_type}
                    </Badge>
                  </View>
                  <View style={styles.tradeDetails}>
                    <View style={styles.tradeMetric}>
                      <Text variant="xs" muted>Quantity</Text>
                      <Text variant="small">{trade.quantity?.toFixed(2)}</Text>
                    </View>
                    <View style={styles.tradeMetric}>
                      <Text variant="xs" muted>Price</Text>
                      <Text variant="small">${trade.price?.toFixed(2) || 'N/A'}</Text>
                    </View>
                    {trade.realized_pnl !== null && (
                      <View style={styles.tradeMetric}>
                        <Text variant="xs" muted>Realized P&L</Text>
                        <Text 
                          variant="small" 
                          weight="semibold"
                          color={trade.realized_pnl > 0 ? theme.success : 
                                 trade.realized_pnl < 0 ? theme.danger : theme.muted}
                        >
                          ${trade.realized_pnl?.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
            
            {/* Trade Summary */}
            {trades.length > 0 && (
              <View style={styles.tradeSummary}>
                <Text variant="body" weight="semibold" style={{ marginBottom: tokens.spacing.sm }}>
                  Summary
                </Text>
                <View style={styles.summaryRow}>
                  <Text variant="small" muted>Total Trades</Text>
                  <Text variant="body" weight="semibold">{trades.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text variant="small" muted>Wins</Text>
                  <Text variant="body" weight="semibold" color={theme.success}>
                    {trades.filter(t => t.realized_pnl > 0).length}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text variant="small" muted>Win Rate</Text>
                  <Text variant="body" weight="semibold">
                    {((trades.filter(t => t.realized_pnl > 0).length / trades.length) * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </Card>
    </ScrollView>
  );

  const renderCreateEdit = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card style={styles.headerCard} elevation="med" noBorder>
        <LinearGradient
          colors={[theme.primary, theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Ionicons name="create" size={48} color={theme.bg} />
            <Text variant="h1" weight="bold" style={[styles.headerTitle, { color: theme.bg }]}>
              {currentPortfolio ? 'Edit Portfolio' : 'Create Portfolio'}
            </Text>
            <Text variant="body" style={[styles.headerSubtitle, { color: theme.bg + 'CC' }]}>
              {currentPortfolio ? 'Update your portfolio settings' : 'Build your perfect investment portfolio'}
            </Text>
          </View>
        </LinearGradient>
      </Card>

      {/* Portfolio Details */}
      <Card style={styles.sectionCard}>
        <Text variant="h3" weight="semibold" style={styles.sectionTitle}>Portfolio Details</Text>
        
        <View style={styles.inputGroup}>
          <Text variant="body" weight="semibold">Portfolio Name</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
            placeholder="Enter portfolio name"
            placeholderTextColor={theme.muted}
            value={portfolioName}
            onChangeText={setPortfolioName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text variant="body" weight="semibold">Description (Optional)</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
            placeholder="Enter description"
            placeholderTextColor={theme.muted}
            value={portfolioDescription}
            onChangeText={setPortfolioDescription}
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text variant="body" weight="semibold">Risk Level</Text>
          <View style={styles.riskLevels}>
            {(['Conservative', 'Moderate', 'Aggressive'] as const).map((level) => (
              <Pressable
                key={level}
                onPress={() => setRiskLevel(level)}
                style={[
                  styles.riskLevelButton,
                  riskLevel === level && { 
                    borderColor: theme.primary, 
                    borderWidth: 2, 
                    backgroundColor: theme.primary + '10' 
                  }
                ]}
              >
                <Ionicons 
                  name="shield" 
                  size={24} 
                  color={riskLevel === level ? theme.primary : theme.muted} 
                />
                <Text variant="body" weight="semibold" center>{level}</Text>
                <Text variant="xs" muted center>
                  {level === 'Conservative' ? 'Low risk, steady returns' :
                   level === 'Moderate' ? 'Balanced approach' :
                   'Higher risk, higher potential'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {/* Asset Selection */}
      <Card style={styles.sectionCard}>
        <Text variant="h3" weight="semibold" style={styles.sectionTitle}>Select Assets</Text>
        
        {/* Asset Type Filter */}
        <View style={styles.filterButtons}>
          {['all', 'stock', 'etf', 'crypto', 'commodity', 'forex'].map((type) => (
            <Pressable
              key={type}
              onPress={() => setAssetType(type)}
              style={[
                styles.filterButton,
                assetType === type && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
            >
              <Text variant="small" weight="semibold" color={assetType === type ? theme.bg : theme.text}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Assets Grid */}
        <View style={styles.assetsGrid}>
          {availableAssets.map((asset) => {
            const isSelected = selectedAssets.some(a => a.id === asset.id);
            return (
              <Pressable
                key={asset.id}
                onPress={() => toggleAsset(asset)}
                style={[
                  styles.assetCard,
                  isSelected && { 
                    borderColor: theme.primary, 
                    borderWidth: 2, 
                    backgroundColor: theme.primary + '10' 
                  }
                ]}
              >
                <Text variant="body" weight="semibold" center>{asset.symbol}</Text>
                <Text variant="xs" muted center numberOfLines={2}>{asset.name}</Text>
                <Badge variant="secondary" size="small" style={{ marginTop: tokens.spacing.xs }}>
                  {asset.type}
                </Badge>
                {isSelected && (
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color={theme.primary} 
                    style={{ marginTop: tokens.spacing.xs }} 
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {selectedAssets.length > 0 && (
          <View style={styles.selectedAssets}>
            <Text variant="body" weight="semibold">Selected Assets ({selectedAssets.length})</Text>
            <Text variant="small" muted>
              {selectedAssets.map(a => a.symbol).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      {/* Asset Allocation */}
      {selectedAssets.length > 0 && (
        <Card style={styles.sectionCard}>
          <View style={styles.allocationHeader}>
            <Text variant="h3" weight="semibold">Asset Allocation</Text>
            <Button
              variant="secondary"
              size="small"
              onPress={autoAllocate}
              icon={<Ionicons name="refresh" size={16} color={theme.text} />}
            >
              Auto Allocate
            </Button>
          </View>
          
          <Text variant="small" muted style={styles.allocationDescription}>
            Set the percentage allocation for each asset (must total 100%)
          </Text>

          {selectedAssets.map((asset) => (
            <View key={asset.id} style={styles.allocationItem}>
              <View style={styles.allocationInfo}>
                <Text variant="body" weight="semibold">{asset.symbol}</Text>
                <Text variant="small" muted>{asset.name}</Text>
              </View>
              <View style={styles.allocationInput}>
                <Text variant="body" weight="semibold">
                  {allocations[asset.id] || 0}%
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.allocationTotal}>
            <Text variant="body" weight="semibold">
              Total: {totalAllocation}%
            </Text>
            {totalAllocation !== 100 && (
              <Text variant="small" color={theme.danger}>
                Must equal 100%
              </Text>
            )}
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          variant="secondary"
          size="large"
          onPress={() => setViewMode('overview')}
          style={styles.actionButton}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="large"
          onPress={savePortfolio}
          disabled={selectedAssets.length === 0 || totalAllocation !== 100}
          style={styles.actionButton}
        >
          {currentPortfolio ? 'Update Portfolio' : 'Create Portfolio'}
        </Button>
      </View>
    </ScrollView>
  );

  const renderAnalyze = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <Card style={styles.headerCard} elevation="med" noBorder>
        <LinearGradient
          colors={[theme.accent, theme.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Ionicons name="analytics" size={48} color={theme.bg} />
            <Text variant="h1" weight="bold" style={[styles.headerTitle, { color: theme.bg }]}>
              Portfolio Analysis
            </Text>
            <Text variant="body" style={[styles.headerSubtitle, { color: theme.bg + 'CC' }]}>
              Analyze performance and optimize your portfolios
            </Text>
          </View>
        </LinearGradient>
      </Card>

      {performanceData ? (
        <>
          <Card style={styles.sectionCard}>
            <Text variant="h3" weight="semibold" style={styles.sectionTitle}>Performance Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text variant="xs" muted>Total Return</Text>
                <Text variant="h3" weight="bold" color={performanceData.TotalReturn >= 0 ? theme.success : theme.danger}>
                  {performanceData.TotalReturn?.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="xs" muted>Sharpe Ratio</Text>
                <Text variant="h3" weight="bold">{performanceData.SharpeRatio?.toFixed(2) || 'N/A'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="xs" muted>Max Drawdown</Text>
                <Text variant="h3" weight="bold" color={theme.danger}>
                  {performanceData.MaxDrawdown?.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="xs" muted>Win Rate</Text>
                <Text variant="h3" weight="bold">{performanceData.WinRate?.toFixed(0)}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="xs" muted>Profit Factor</Text>
                <Text variant="h3" weight="bold">{performanceData.ProfitFactor?.toFixed(2) || 'N/A'}</Text>
              </View>
            </View>
          </Card>
        </>
      ) : (
        <Card style={styles.sectionCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>No Performance Data</Text>
          <Text variant="body" muted center>
            Portfolio performance metrics will appear here once you have trading activity
          </Text>
        </Card>
      )}
    </ScrollView>
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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>
          {viewMode === 'overview' ? 'Portfolio Manager' :
           viewMode === 'create' ? 'Create Portfolio' :
           viewMode === 'edit' ? 'Edit Portfolio' :
           'Portfolio Analysis'}
        </Text>
        <View style={styles.headerRight}>
          {viewMode !== 'overview' && (
            <Pressable onPress={() => setViewMode('overview')} style={styles.headerButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Content */}
      {viewMode === 'overview' && renderOverview()}
      {(viewMode === 'create' || viewMode === 'edit') && renderCreateEdit()}
      {viewMode === 'analyze' && renderAnalyze()}

      {/* FAB */}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  headerButton: {
    padding: tokens.spacing.xs,
  },
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl * 2,
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
    marginTop: tokens.spacing.xs,
  },
  quickActionsCard: {
    padding: tokens.spacing.md,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: 'transparent',
  },
  quickActionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  portfoliosCard: {
    padding: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  emptyTitle: {
    marginTop: tokens.spacing.sm,
  },
  emptyDescription: {
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  emptyActionButton: {
    marginTop: tokens.spacing.sm,
  },
  portfoliosList: {
    gap: tokens.spacing.md,
  },
  portfolioItem: {
    padding: tokens.spacing.md,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.sm,
  },
  portfolioInfo: {
    flex: 1,
  },
  portfolioActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  actionButton: {
    padding: tokens.spacing.xs,
  },
  portfolioStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  sectionCard: {
    padding: tokens.spacing.md,
  },
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  input: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    marginTop: tokens.spacing.xs,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  riskLevels: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  riskLevelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: tokens.spacing.xs,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  filterButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  assetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    justifyContent: 'center',
  },
  assetCard: {
    alignItems: 'center',
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    minWidth: 100,
  },
  selectedAssets: {
    marginTop: tokens.spacing.md,
    padding: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: tokens.radius.md,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  allocationDescription: {
    marginBottom: tokens.spacing.md,
  },
  allocationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  allocationInfo: {
    flex: 1,
  },
  allocationInput: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  allocationTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  fab: {
    position: 'absolute',
    bottom: tokens.spacing.xl,
    right: tokens.spacing.md,
  },
  recommendationsCard: {
    gap: tokens.spacing.md,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendationsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  recommendationsDescription: {
    lineHeight: 20,
  },
  recommendationsList: {
    gap: tokens.spacing.sm,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: tokens.radius.md,
  },
  recommendationContent: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  recommendationMetrics: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: tokens.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: tokens.radius.md,
  },
  positionsList: {
    gap: tokens.spacing.sm,
  },
  positionRow: {
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  positionDetails: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  positionMetric: {
    flex: 1,
  },
  tradesList: {
    gap: tokens.spacing.sm,
  },
  tradeRow: {
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  tradeDetails: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  tradeMetric: {
    flex: 1,
  },
  tradeSummary: {
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: tokens.spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});