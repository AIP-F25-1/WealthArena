/**
 * Game Setup Page
 * Beginner-friendly game configuration with multiple instrument selection
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Badge, 
  FAB, 
  tokens 
} from '@/src/design-system';
import { createGameSession, apiService } from '@/services/apiService';
import { cachedAssetService, TradingAsset } from '@/services/cachedAssetService';
import { marketDataService } from '@/services/marketDataService';

const { width } = Dimensions.get('window');

// Icon mapping for asset types
const getAssetIcon = (type: string, symbol: string): string => {
  const iconMap: Record<string, string> = {
    'SPY': 'trending-up',
    'QQQ': 'laptop',
    'AAPL': 'phone-portrait',
    'MSFT': 'desktop',
    'GOOGL': 'search',
    'AMZN': 'cart',
    'TSLA': 'car',
    'NVDA': 'hardware-chip',
    'META': 'people',
    'NFLX': 'film',
  };
  
  if (iconMap[symbol]) return iconMap[symbol];
  
  switch (type) {
    case 'etf': return 'trending-up';
    case 'crypto': return 'logo-bitcoin';
    case 'forex': return 'swap-horizontal';
    case 'commodity': return 'cube';
    default: return 'bar-chart';
  }
};

// Risk level mapping
const getRiskLevel = (type: string, symbol: string): 'Low' | 'Medium' | 'High' => {
  // ETFs are generally lower risk
  if (type === 'etf') {
    if (['SPY', 'VTI', 'DIA'].includes(symbol)) return 'Low';
    return 'Medium';
  }
  
  // Crypto and commodities are higher risk
  if (type === 'crypto' || type === 'commodity') return 'High';
  
  // Forex is medium risk
  if (type === 'forex') return 'Medium';
  
  // Stocks vary, default to medium
  return 'Medium';
};

const GAME_MODES = [
  {
    id: 'beginner',
    name: 'Beginner Mode',
    description: 'Simple charts, helpful tips, and step-by-step guidance',
    icon: 'school',
    color: '#4CAF50',
    features: [
      'Simplified price charts (no complex candlesticks)',
      'Real-time trading tips and explanations',
      'Educational tooltips on every action',
      'Slower game speed for learning'
    ]
  },
  {
    id: 'standard',
    name: 'Standard Mode',
    description: 'Balanced experience with moderate guidance',
    icon: 'bar-chart',
    color: '#2196F3',
    features: [
      'Standard candlestick charts',
      'Basic trading indicators',
      'Some helpful hints',
      'Normal game speed'
    ]
  },
  {
    id: 'advanced',
    name: 'Advanced Mode',
    description: 'Full market data and advanced tools',
    icon: 'analytics',
    color: '#FF9800',
    features: [
      'Advanced technical indicators',
      'Volume analysis',
      'Multiple timeframes',
      'Fast-paced gameplay'
    ]
  }
];

const DIFFICULTY_LEVELS = [
  {
    id: 'easy',
    name: 'Easy',
    startingCash: 100000,
    fees: '0.1%',
    color: '#4CAF50'
  },
  {
    id: 'medium',
    name: 'Medium',
    startingCash: 50000,
    fees: '0.2%',
    color: '#FF9800'
  },
  {
    id: 'hard',
    name: 'Hard',
    startingCash: 25000,
    fees: '0.5%',
    color: '#F44336'
  }
];

export default function GameSetupScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['SPY']);
  const [gameMode, setGameMode] = useState<string>('beginner');
  const [difficulty, setDifficulty] = useState<string>('easy');
  const [portfolioName, setPortfolioName] = useState<string>('My First Portfolio');
  const [showPortfolioInput, setShowPortfolioInput] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<TradingAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  // Load assets from database on mount
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setIsLoadingAssets(true);
        
        // First try to get available symbols from backend database
        try {
          console.log('Loading assets from backend...');
          const availableSymbols = await marketDataService.getAvailableSymbols();
          
          console.log(`Backend returned ${availableSymbols?.length || 0} symbols`);
          
          if (availableSymbols && availableSymbols.length > 0) {
            // Detect asset type from symbol patterns
            const detectAssetType = (symbol: string): TradingAsset['type'] => {
              // Forex: ends with =X
              if (symbol.endsWith('=X')) return 'forex';
              // Crypto: contains -USD or -USDT
              if (symbol.includes('-USD') || symbol.includes('-USDT')) return 'crypto';
              // Commodities: ends with =F
              if (symbol.endsWith('=F')) return 'commodity';
              // ETFs: common ETF symbols
              if (['SPY', 'QQQ', 'VTI', 'IWM', 'DIA', 'ARKK'].includes(symbol)) return 'etf';
              // Australian stocks: ends with .AX
              if (symbol.endsWith('.AX')) return 'stock';
              // Default to stock
              return 'stock';
            };
            
            // Map symbols to TradingAsset format with proper type detection
            const assetsFromDb: TradingAsset[] = availableSymbols.map((symbol, index) => {
              const assetType = detectAssetType(symbol);
              return {
                id: `asset-${index}`,
                symbol,
                name: symbol, // Will be enhanced with full name if available
                type: assetType,
                exchange: symbol.endsWith('.AX') ? 'ASX' : 'US',
                description: `Trading asset: ${symbol}`,
              };
            });
            
            console.log(`Mapped ${assetsFromDb.length} assets, validating data availability...`);
            
            // Skip validation check - if backend returned symbols, they have data
            // The validation was too slow and causing issues
            console.log(`Using all ${assetsFromDb.length} symbols from backend (skipping slow validation)`);
            
            if (assetsFromDb.length > 0) {
              setAvailableAssets(assetsFromDb);
              // Default to first asset (don't look for SPY since we have Australian stocks)
              setSelectedSymbols([assetsFromDb[0].symbol]);
              setIsLoadingAssets(false);
              console.log(`✓ Loaded ${assetsFromDb.length} real assets from backend`);
              return;
            } else {
              console.warn('No assets found, but symbols were returned from backend');
            }
          } else {
            console.warn('Backend returned empty or no symbols');
          }
        } catch (dbError) {
          console.error('Failed to load assets from database:', dbError);
          // Don't fall back to cached service - show error instead
          Alert.alert(
            'Data Loading Error',
            `Failed to load trading assets from backend: ${dbError instanceof Error ? dbError.message : 'Unknown error'}\n\nPlease ensure the backend is running and has processed market data.`,
            [{ text: 'OK' }]
          );
          setIsLoadingAssets(false);
          return;
        }
        
        // If we get here, no real assets were found
        console.error('No real assets available - backend may not have data loaded');
        Alert.alert(
          'No Data Available',
          'No market data is available. Please ensure:\n\n1. Backend is running\n2. Market data has been processed (run: node backend/scripts/processMarketData.js --mvp)\n3. Backend has loaded the data',
          [{ text: 'OK' }]
        );
        setAvailableAssets([]);
      } catch (error) {
        console.error('Error loading assets:', error);
        setAvailableAssets([]);
        Alert.alert(
          'No Data Available',
          'No market data is available. Please ensure the database has been initialized with CSV data.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      } finally {
        setIsLoadingAssets(false);
      }
    };

    loadAssets();
  }, []);

  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      if (selectedSymbols.length === 1) {
        Alert.alert('Cannot Remove', 'You must select at least one symbol');
        return;
      }
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const handleStartGame = async () => {
    setIsCreatingSession(true);
    setSessionError(null);
    
    try {
      // Validate that selected symbols have data
      for (const symbol of selectedSymbols) {
        const hasData = await marketDataService.checkDataAvailability(symbol);
        if (!hasData) {
          const availableSymbols = await marketDataService.getAvailableSymbols();
          Alert.alert(
            'Data Unavailable',
            `No historical data is available for ${symbol}. ` +
            `Please select a different symbol. ` +
            (availableSymbols.length > 0 
              ? `Available symbols: ${availableSymbols.slice(0, 10).join(', ')}`
              : 'No symbols have data available. Please initialize the database first.'),
            [
              { text: 'OK', style: 'default' }
            ]
          );
          setIsCreatingSession(false);
          return;
        }
      }
      
      // Create game session via API - pass game setup context for backend persistence
      // This ensures session metadata (symbols, difficulty, starting cash) is stored
      // for proper resume functionality and analytics
      const sessionResponse = await createGameSession({
        gameType: gameMode,
        symbols: selectedSymbols,
        difficulty: difficulty,
        startingCash: selectedDiff?.startingCash
      });
      const sessionId = sessionResponse.data.sessionId;
      
      // Navigate with session ID and additional params for game-play
      const params = {
        sessionId, // NEW - pass session ID
        symbols: selectedSymbols.join(','),
        mode: gameMode,
        difficulty: difficulty,
        portfolioName: portfolioName
      };
      
      router.push({
        pathname: '/game-play',
        params: params
      });
    } catch (error: any) {
      console.error('Failed to create game session:', error);
      const errorMessage = error.message || 'Failed to start game. Please try again.';
      setSessionError(errorMessage);
      
      if (errorMessage.includes('Game session not found') || errorMessage.includes('not found')) {
        Alert.alert(
          'Session Error',
          'Failed to create game session. Please ensure:\n' +
          '1. Backend is running\n' +
          '2. Database is connected\n' +
          '3. Selected symbols have data available',
          [
            { text: 'Go Back', onPress: () => router.back(), style: 'cancel' },
            { text: 'Try Again', onPress: () => handleStartGame(), style: 'default' }
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsCreatingSession(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return theme.success;
      case 'Medium': return theme.yellow;
      case 'High': return theme.danger;
      default: return theme.muted;
    }
  };

  const selectedMode = GAME_MODES.find(m => m.id === gameMode);
  const selectedDiff = DIFFICULTY_LEVELS.find(d => d.id === difficulty);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Setup Your Game</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <Card style={styles.heroCard} elevation="high" noBorder>
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Ionicons name="game-controller" size={48} color="#FFFFFF" />
            <Text variant="h2" weight="bold" color="#FFFFFF" center>
              Customize Your Trading Game
            </Text>
            <Text variant="body" color="#FFFFFF" center style={{ opacity: 0.9 }}>
              Select instruments, choose your mode, and start learning!
            </Text>
          </LinearGradient>
        </Card>

        {/* Portfolio Name Section */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold">Name Your Portfolio</Text>
          <Text variant="small" muted>
            Give your trading portfolio a unique name
          </Text>
          
          <Card style={styles.portfolioCard}>
            <View style={styles.portfolioHeader}>
              <Ionicons name="briefcase" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                {showPortfolioInput ? (
                  <View style={styles.inputContainer}>
                    <Pressable
                      style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface }]}
                      onPress={() => {
                        Alert.prompt(
                          'Portfolio Name',
                          'Enter a name for your portfolio',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Save', 
                              onPress: (text?: string) => {
                                if (text?.trim()) {
                                  setPortfolioName(text.trim());
                                  setShowPortfolioInput(false);
                                }
                              }
                            }
                          ],
                          'plain-text',
                          portfolioName
                        );
                      }}
                    >
                      <Text variant="body">{portfolioName}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setShowPortfolioInput(true)}>
                    <Text variant="body" weight="semibold">{portfolioName}</Text>
                    <Text variant="xs" muted>Tap to change name</Text>
                  </Pressable>
                )}
              </View>
              <Pressable onPress={() => setShowPortfolioInput(!showPortfolioInput)}>
                <Ionicons 
                  name={showPortfolioInput ? "checkmark-circle" : "pencil"} 
                  size={24} 
                  color={theme.primary} 
                />
              </Pressable>
            </View>
          </Card>
        </View>

        {/* Game Mode Selection */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold">Choose Game Mode</Text>
          <Text variant="small" muted>
            Beginners should start with Beginner Mode for the best learning experience
          </Text>
          
          {GAME_MODES.map((modeOption) => (
            <Pressable 
              key={modeOption.id}
              onPress={() => setGameMode(modeOption.id)}
            >
              <Card
                style={StyleSheet.flatten([
                  styles.modeCard,
                  gameMode === modeOption.id && {
                    borderColor: modeOption.color,
                    borderWidth: 2,
                    backgroundColor: modeOption.color + '10'
                  }
                ])}
                elevation="low"
              >
                <View style={styles.modeHeader}>
                  <View style={[styles.modeIcon, { backgroundColor: modeOption.color + '20' }]}>
                    <Ionicons name={modeOption.icon as any} size={28} color={modeOption.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="bold">{modeOption.name}</Text>
                    <Text variant="small" muted>{modeOption.description}</Text>
                  </View>
                  {gameMode === modeOption.id && (
                    <Ionicons name="checkmark-circle" size={24} color={modeOption.color} />
                  )}
                </View>
                
                {gameMode === modeOption.id && (
                  <View style={styles.featuresList}>
                    {modeOption.features.map((feature) => (
                      <View key={feature} style={styles.featureItem}>
                        <Ionicons name="checkmark" size={16} color={modeOption.color} />
                        <Text variant="xs" muted>{feature}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </Pressable>
          ))}
        </View>

        {/* Difficulty Selection */}
        <View style={styles.section}>
          <Text variant="h3" weight="semibold">Select Difficulty</Text>
          <Text variant="small" muted>
            Higher difficulty means less starting cash and higher trading fees
          </Text>
          
          <View style={styles.difficultyRow}>
            {DIFFICULTY_LEVELS.map((diff) => {
              // Determine badge variant based on difficulty
              const getBadgeVariant = () => {
                if (diff.id === 'easy') return 'success';
                if (diff.id === 'medium') return 'warning';
                return 'danger';
              };
              
              return (
              <Pressable 
                key={diff.id}
                onPress={() => setDifficulty(diff.id)}
                style={{ flex: 1 }}
              >
                <Card
                  style={StyleSheet.flatten([
                    styles.difficultyCard,
                    difficulty === diff.id && {
                      borderColor: diff.color,
                      borderWidth: 2,
                      backgroundColor: diff.color + '10'
                    }
                  ])}
                >
                  <Badge 
                    variant={getBadgeVariant()} 
                    size="small"
                  >
                    {diff.name}
                  </Badge>
                  <Text variant="small" weight="semibold" center>
                    ${(diff.startingCash / 1000).toFixed(0)}K
                  </Text>
                  <Text variant="xs" muted center>
                    {diff.fees} fees
                  </Text>
                  {difficulty === diff.id && (
                    <Ionicons name="checkmark-circle" size={20} color={diff.color} />
                  )}
                </Card>
              </Pressable>
              )
            })}
          </View>
        </View>

        {/* Symbol Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text variant="h3" weight="semibold">Select Instruments</Text>
              <Text variant="small" muted>
                Choose one or more assets to trade
              </Text>
            </View>
            <Badge variant="primary" size="medium">
              {selectedSymbols.length} selected
            </Badge>
          </View>
          
          {gameMode === 'beginner' && (
            <Card style={StyleSheet.flatten([styles.tipCard, { backgroundColor: theme.primary + '10' }])}>
              <Ionicons name="bulb" size={20} color={theme.primary} />
              <Text variant="small" color={theme.primary}>
                <Text weight="bold">Beginner Tip: </Text>
                Start with SPY (S&P 500 ETF) - it's less risky and easier to learn with!
              </Text>
            </Card>
          )}

          {isLoadingAssets ? (
            <Card style={styles.symbolCard}>
              <Text variant="body" muted center>Loading assets from database...</Text>
            </Card>
          ) : availableAssets.length === 0 ? (
            <Card style={styles.symbolCard}>
              <Text variant="body" muted center>No assets available</Text>
              <Text variant="small" muted center style={{ marginTop: tokens.spacing.xs }}>
                Please ensure your database has market data
              </Text>
            </Card>
          ) : (
            <View style={styles.symbolGrid}>
              {availableAssets.map((asset) => {
                const isSelected = selectedSymbols.includes(asset.symbol);
                const risk = getRiskLevel(asset.type, asset.symbol);
                const riskColor = getRiskColor(risk);
                const icon = getAssetIcon(asset.type, asset.symbol);
                
                return (
                  <Pressable 
                    key={asset.id}
                    onPress={() => toggleSymbol(asset.symbol)}
                    style={{ width: (width - tokens.spacing.md * 3) / 2 }}
                  >
                    <Card
                      style={StyleSheet.flatten([
                        styles.symbolCard,
                        isSelected && {
                          borderColor: theme.primary,
                          borderWidth: 2,
                          backgroundColor: theme.primary + '10'
                        }
                      ])}
                      elevation="low"
                    >
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                        </View>
                      )}
                      
                      <View style={[styles.symbolIcon, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name={icon as any} size={24} color={theme.primary} />
                      </View>
                      
                      <Text variant="body" weight="bold" center>{asset.symbol}</Text>
                      <Text variant="xs" muted center numberOfLines={1}>{asset.name}</Text>
                      
                      <View style={styles.symbolMeta}>
                        <Badge 
                          variant="secondary" 
                          size="small"
                          style={{ backgroundColor: riskColor + '20' }}
                        >
                          <Text variant="xs" color={riskColor}>{risk}</Text>
                        </Badge>
                        <Badge variant="secondary" size="small">
                          <Text variant="xs">{asset.type.toUpperCase()}</Text>
                        </Badge>
                      </View>
                      
                      {gameMode === 'beginner' && asset.description && (
                        <Text variant="xs" muted center numberOfLines={2} style={{ marginTop: 4 }}>
                          {asset.description}
                        </Text>
                      )}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Summary Card */}
        <Card style={styles.summaryCard} elevation="med">
          <Text variant="h3" weight="semibold">Game Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text variant="small" muted>Mode:</Text>
            <Badge variant="primary" size="medium">{selectedMode?.name}</Badge>
          </View>
          
          <View style={styles.summaryRow}>
            <Text variant="small" muted>Difficulty:</Text>
            <Badge 
              variant={
                difficulty === 'easy' ? 'success' : 
                difficulty === 'medium' ? 'warning' : 
                'danger'
              } 
              size="medium"
            >
              {selectedDiff?.name}
            </Badge>
          </View>
          
          <View style={styles.summaryRow}>
            <Text variant="small" muted>Starting Cash:</Text>
            <Text variant="body" weight="bold" color={theme.success}>
              ${selectedDiff?.startingCash.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text variant="small" muted>Instruments:</Text>
            <View style={styles.symbolTags}>
              {selectedSymbols.map(symbol => (
                <Badge key={symbol} variant="primary" size="small">
                  {symbol}
                </Badge>
              ))}
            </View>
          </View>
        </Card>

        {/* Start Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          onPress={handleStartGame}
          disabled={isCreatingSession || selectedSymbols.length === 0}
          icon={<Ionicons name="play" size={24} color={theme.bg} />}
        >
          {isCreatingSession ? 'Creating Session...' : 'Start Game'}
        </Button>
        
        {sessionError && (
          <Card style={{ backgroundColor: theme.danger + '20', padding: tokens.spacing.sm }}>
            <Text variant="small" color={theme.danger}>{sessionError}</Text>
          </Card>
        )}

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
    gap: tokens.spacing.lg,
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: tokens.spacing.lg,
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  section: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeCard: {
    gap: tokens.spacing.sm,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  modeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresList: {
    gap: tokens.spacing.xs,
    paddingLeft: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.xs,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  difficultyCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  tipCard: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    alignItems: 'center',
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  symbolCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: tokens.spacing.xs,
    right: tokens.spacing.xs,
    zIndex: 1,
  },
  symbolIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolMeta: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  summaryCard: {
    gap: tokens.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  portfolioCard: {
    gap: tokens.spacing.sm,
  },
  portfolioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
  },
});