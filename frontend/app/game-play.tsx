/**
 * Game Play Screen
 * Beginner-friendly trading game with educational tooltips
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  Badge, 
  FAB, 
  tokens 
} from '@/src/design-system';
import CandlestickChart from '../components/CandlestickChart';
import { apiService } from '@/services/apiService';
import { useGamification } from '@/contexts/GamificationContext';

// Tutorial steps for beginner mode
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Trading!',
    description: 'Let\'s learn the basics of trading step by step. This game uses real historical market data so you can practice risk-free.',
    icon: 'hand-right',
  },
  {
    id: 'reading-charts',
    title: 'Reading Price Charts',
    description: 'The green line shows the price going UP. The red line shows the price going DOWN. Each point represents the price at a specific time.',
    icon: 'analytics',
  },
  {
    id: 'buying',
    title: 'How to Buy',
    description: 'When you think the price will go UP, you BUY. You\'ll make money if the price increases after you buy.',
    icon: 'trending-up',
  },
  {
    id: 'selling',
    title: 'How to Sell',
    description: 'When you think the price will go DOWN (or you want to lock in profits), you SELL. Selling closes your position.',
    icon: 'trending-down',
  },
  {
    id: 'portfolio',
    title: 'Your Portfolio',
    description: 'Your portfolio shows all the investments you own and how much money you have. The P&L (Profit & Loss) shows if you\'re winning or losing.',
    icon: 'wallet',
  },
];

export default function GamePlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { awardXP, awardCoins } = useGamification();
  
  // Parse params
  const symbols = (params.symbols as string)?.split(',') || ['SPY'];
  const mode = (params.mode as string) || 'beginner';
  const difficulty = (params.difficulty as string) || 'easy';
  const portfolioName = (params.portfolioName as string) || 'My Portfolio';
  const sessionId = params.sessionId as string;
  
  const [currentSymbol, setCurrentSymbol] = useState(symbols[0]);
  const [balance, setBalance] = useState(difficulty === 'easy' ? 100000 : difficulty === 'medium' ? 50000 : 25000);
  const [positions, setPositions] = useState<any[]>([]);
  const [showTutorial, setShowTutorial] = useState(mode === 'beginner');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(450.00);
  const [priceHistory, setPriceHistory] = useState<number[]>([450.00]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [currentDataIndex, setCurrentDataIndex] = useState(0);
  const [pnl, setPnl] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSession, setGameSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dataInterval, setDataInterval] = useState<NodeJS.Timeout | null>(null);

  // Load historical data for the symbol
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        setIsLoading(true);
        
        // Validate symbol has data before proceeding
        const { marketDataService } = await import('@/services/marketDataService');
        const hasData = await marketDataService.checkDataAvailability(currentSymbol);
        
        if (!hasData) {
          Alert.alert(
            'Insufficient Data',
            `Not enough historical data available for ${currentSymbol}. ` +
            `At least 30 days of data are required for gameplay. ` +
            `Please select a different symbol or ensure data is loaded.`,
            [
              { text: 'Go Back', onPress: () => router.back(), style: 'default' }
            ]
          );
          setIsLoading(false);
          return;
        }
        
        // Try backend database first
        try {
          const { resolveBackendURL } = await import('@/utils/networkConfig');
          const { getAuthHeaders } = await import('@/services/apiService');
          const backendUrl = await resolveBackendURL(3000);
          
          const response = await fetch(
            `${backendUrl}/api/market-data/history/${currentSymbol}?period=60d&days=60`,
            {
              headers: await getAuthHeaders(),
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              // Ensure we have at least 30 days of data
              if (result.data.length < 30) {
                Alert.alert(
                  'Insufficient Data',
                  `Only ${result.data.length} days of data available for ${currentSymbol}. ` +
                  `At least 30 days are required for gameplay.`,
                  [
                    { text: 'Go Back', onPress: () => router.back(), style: 'default' }
                  ]
                );
                setIsLoading(false);
                return;
              }
              
              // Convert to candles format
              const candles = result.data.map((candle: any) => ({
                t: new Date(candle.time).getTime() / 1000,
                o: candle.open,
                h: candle.high,
                l: candle.low,
                c: candle.close,
                v: candle.volume || 0,
              }));
              
              const prices = candles.map((candle: any) => candle.c);
              setHistoricalData(candles);
              setPriceHistory(prices);
              setCurrentPrice(prices[prices.length - 1] || 450.00);
              setCurrentDataIndex(prices.length - 1);
              setIsLoading(false);
              return;
            }
          }
        } catch (dbError) {
          console.warn('Backend database fetch failed, trying chatbot API...', dbError);
        }
        
        // Fallback to chatbot API
        const chatbotUrl = process.env.EXPO_PUBLIC_CHATBOT_URL || 'http://localhost:8000';
        const response = await fetch(
          `${chatbotUrl}/v1/market/ohlc?symbol=${currentSymbol}&period=60d&interval=1d`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.candles && data.candles.length > 0) {
            // Ensure we have at least 30 days of data
            if (data.candles.length < 30) {
              Alert.alert(
                'Insufficient Data',
                `Only ${data.candles.length} days of data available for ${currentSymbol}. ` +
                `At least 30 days are required for gameplay.`,
                [
                  { text: 'Go Back', onPress: () => router.back(), style: 'default' }
                ]
              );
              setIsLoading(false);
              return;
            }
            
            // Convert candles to price array (using close prices)
            const prices = data.candles.map((candle: any) => candle.c);
            setHistoricalData(data.candles);
            setPriceHistory(prices);
            setCurrentPrice(prices[prices.length - 1] || 450.00);
            setCurrentDataIndex(prices.length - 1);
          } else {
            throw new Error('No candles data in response');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error: any) {
        console.error('Error loading historical data:', error);
        Alert.alert(
          'Data Load Failed',
          `Failed to load historical data for ${currentSymbol}: ${error.message}\n\n` +
          `Please ensure:\n` +
          `1. Backend is running\n` +
          `2. Database has data for this symbol\n` +
          `3. Network connection is available`,
          [
            { text: 'Go Back', onPress: () => router.back(), style: 'default' },
            { text: 'Try Again', onPress: () => loadHistoricalData(), style: 'default' }
          ]
        );
        // Fallback to default
        setHistoricalData([]);
        setPriceHistory([450.00]);
        setCurrentPrice(450.00);
        setCurrentDataIndex(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistoricalData();
  }, [currentSymbol]);

  // Initialize or resume game session
  useEffect(() => {
    const initializeGame = async () => {
      try {
        if (sessionId) {
          // Resume existing session
          try {
            const sessionData = await apiService.resumeGameSession(sessionId);
            if (sessionData.success && sessionData.data) {
              setGameSession(sessionData.data);
              setBalance(sessionData.data.currentBalance || balance);
              setPositions(sessionData.data.positions || []);
              setCurrentPrice(sessionData.data.currentPrice || 450.00);
              setPriceHistory(sessionData.data.priceHistory || [450.00]);
              setCurrentDataIndex(sessionData.data.currentDataIndex || 0);
            } else {
              throw new Error('Session data not found');
            }
          } catch (sessionError: any) {
            Alert.alert(
              'Session Not Found',
              `Failed to resume game session: ${sessionError.message}\n\n` +
              `The session may have expired or been deleted.`,
              [
                { text: 'Go Back', onPress: () => router.back(), style: 'cancel' },
                { text: 'Start New Game', onPress: () => {
                  router.replace('/game-setup');
                }, style: 'default' }
              ]
            );
          }
        } else {
          // Create new session
          try {
            const newSession = await apiService.createGameSession({
              gameType: mode,
              symbols: symbols,
              difficulty: difficulty,
              startingCash: balance,
            });
            
            if (newSession.success && newSession.data) {
              setGameSession(newSession.data);
            } else {
              throw new Error('Failed to create session');
            }
          } catch (createError: any) {
            Alert.alert(
              'Session Creation Failed',
              `Failed to create game session: ${createError.message}\n\n` +
              `Please ensure:\n` +
              `1. Backend is running\n` +
              `2. Database is connected\n` +
              `3. Selected symbols have data available`,
              [
                { text: 'Go Back', onPress: () => router.back(), style: 'cancel' },
                { text: 'Try Again', onPress: () => initializeGame(), style: 'default' }
              ]
            );
          }
        }
      } catch (error: any) {
        console.error('Failed to initialize game session:', error);
        // Show user-friendly error
        Alert.alert(
          'Initialization Error',
          error.message || 'Failed to initialize game. Please try again.',
          [
            { text: 'Go Back', onPress: () => router.back(), style: 'cancel' }
          ]
        );
      }
    };

    initializeGame();
  }, [sessionId, mode]);

  // Save game session
  const saveGameSession = async () => {
    if (!gameSession?.sessionId) return;

    try {
      const gameState = {
        currentBalance: balance,
        positions,
        currentPrice,
        priceHistory,
        pnl,
        currentStep: priceHistory.length,
        timestamp: new Date(),
      };

      await apiService.saveGameSession(gameSession.sessionId, gameState);
      
      Alert.alert('Game Saved', 'Your progress has been saved successfully!');
    } catch (error) {
      console.error('Failed to save game session:', error);
      Alert.alert('Save Failed', 'Could not save your progress. Please try again.');
    }
  };

  // Complete game session
  const completeGameSession = async () => {
    if (!gameSession?.sessionId) return;

    try {
      const results = {
        finalBalance: balance,
        totalPnL: pnl,
        positions,
        trades: [], // Would track actual trades
        duration: priceHistory.length,
        performance: {
          profitPercentage: (pnl / (balance - pnl)) * 100,
        },
      };

      const completionData = await apiService.completeGameSession(gameSession.sessionId, results);
      
      // Award XP and coins based on performance
      const xpAward = Math.max(10, Math.floor(completionData.rewards.xp));
      const coinAward = Math.max(50, Math.floor(completionData.rewards.coins));
      
      await awardXP(xpAward, 'Completed game session');
      await awardCoins(coinAward, 'Completed game session');
      
      Alert.alert(
        'Game Complete!',
        `Great job! You earned ${xpAward} XP and ${coinAward} coins!`,
        [
          { text: 'View Results', onPress: () => router.push('/vs-ai-gameover') },
          { text: 'New Game', onPress: () => router.push('/game-setup') },
        ]
      );
    } catch (error) {
      console.error('Failed to complete game session:', error);
      Alert.alert('Completion Failed', 'Could not complete the game. Please try again.');
    }
  };

  // Discard game session
  const discardGameSession = async () => {
    if (!gameSession?.sessionId) return;

    Alert.alert(
      'Discard Game',
      'Are you sure you want to discard this game? All progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.discardGameSession(gameSession.sessionId);
              router.back();
            } catch (error) {
              console.error('Failed to discard game session:', error);
            }
          },
        },
      ]
    );
  };
  
  // Generate chart data from price history or historical data
  const chartData = historicalData.length > 0
    ? historicalData.slice(Math.max(0, currentDataIndex - 29), currentDataIndex + 1).map((candle: any, index: number) => ({
        time: new Date(candle.t * 1000).toISOString().split('T')[0],
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c
      }))
    : priceHistory.slice(-30).map((price, index) => ({
        time: `T${index + 1}`,
        open: index > 0 ? priceHistory[priceHistory.length - 30 + index - 1] : price,
        high: price + Math.random() * 2,
        low: price - Math.random() * 2,
        close: price
      }));

  // Simulate price movements using historical data
  useEffect(() => {
    if (!isPlaying || isPaused) {
      // Clear any existing interval when paused or stopped
      if (dataInterval) {
        clearInterval(dataInterval);
        setDataInterval(null);
      }
      return;
    }
    
    const interval = setInterval(() => {
      let newPrice = currentPrice;
      
      // Use historical data if available, otherwise use random movement as fallback
      if (historicalData.length > 0 && currentDataIndex < historicalData.length - 1) {
        // Move to next data point
        const nextIndex = currentDataIndex + 1;
        const nextCandle = historicalData[nextIndex];
        newPrice = nextCandle.c;
        
        setCurrentPrice(newPrice);
        setCurrentDataIndex(nextIndex);
        setPriceHistory(prev => [...prev.slice(-50), newPrice]); // Keep last 50 points
      } else if (historicalData.length > 0) {
        // Reached end of historical data, use last price and pause
        const lastCandle = historicalData[historicalData.length - 1];
        newPrice = lastCandle.c;
        setCurrentPrice(newPrice);
        // Auto-pause when data ends
        setIsPaused(true);
        setIsPlaying(false);
      } else {
        // No historical data available - pause game instead of using mock data
        console.warn('No historical data available for game simulation');
        setIsPaused(true);
        setIsPlaying(false);
        Alert.alert(
          'Data Unavailable',
          'Historical market data is not available. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
        return; // Exit early to prevent mock data usage
      }
      
      // Update positions P&L
      const totalPnL = positions.reduce((sum, pos) => {
        return sum + ((newPrice - pos.entryPrice) * pos.quantity);
      }, 0);
      setPnl(totalPnL);
    }, mode === 'beginner' ? 2000 : mode === 'standard' ? 1000 : 500);
    
    setDataInterval(interval);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, isPaused, currentPrice, positions, mode, historicalData, currentDataIndex]);

  const handleBuy = () => {
    if (mode === 'beginner' && tutorialStep < TUTORIAL_STEPS.length && !showTutorial) {
      Alert.alert(
        '💡 Trading Tip',
        'You\'re buying at $' + currentPrice.toFixed(2) + '. You\'ll make money if the price goes UP from here!',
        [{ text: 'Got it!', onPress: () => executeBuy() }]
      );
    } else {
      executeBuy();
    }
  };

  const executeBuy = () => {
    const quantity = 10; // Fixed quantity for simplicity
    const cost = currentPrice * quantity;
    
    if (balance < cost) {
      Alert.alert('Insufficient Funds', 'You don\'t have enough cash to buy this position.');
      return;
    }
    
    setBalance(prev => prev - cost);
    setPositions(prev => [...prev, {
      symbol: currentSymbol,
      quantity: quantity,
      entryPrice: currentPrice,
      timestamp: new Date().toISOString()
    }]);
    
    if (mode === 'beginner') {
      Alert.alert(
        '✅ Purchase Complete!',
        `You bought ${quantity} shares of ${currentSymbol} at $${currentPrice.toFixed(2)}\n\nNow wait for the price to go UP to make profit!`
      );
    }
  };

  const handleSell = () => {
    if (positions.length === 0) {
      Alert.alert('No Positions', 'You don\'t have any positions to sell.');
      return;
    }
    
    const position = positions[0];
    const profit = (currentPrice - position.entryPrice) * position.quantity;
    const proceeds = currentPrice * position.quantity;
    
    setBalance(prev => prev + proceeds);
    setPositions(prev => prev.slice(1));
    setPnl(prev => prev - profit);
    
    if (mode === 'beginner') {
      const profitText = profit >= 0 
        ? `You made $${profit.toFixed(2)} profit! 🎉` 
        : `You lost $${Math.abs(profit).toFixed(2)} 😔`;
      
      Alert.alert(
        '✅ Position Closed!',
        `You sold ${position.quantity} shares of ${position.symbol}\n\n${profitText}`
      );
    }
  };

  const nextTutorialStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(prev => prev + 1);
    } else {
      setShowTutorial(false);
      setIsPlaying(true);
    }
  };

  const skipTutorial = () => {
    setShowTutorial(false);
    setIsPlaying(true);
  };

  const currentTutorial = TUTORIAL_STEPS[tutorialStep];

  const handleExit = () => {
    if (isPlaying) {
      // Pause the game first
      setIsPaused(true);
      setIsPlaying(false);
      
      Alert.alert(
        'Game Paused',
        'The game has been paused. You can resume or exit.',
        [
          { 
            text: 'Resume', 
            onPress: () => {
              setIsPaused(false);
              setIsPlaying(true);
            }
          },
          { 
            text: 'Exit', 
            style: 'destructive',
            onPress: () => {
              setIsPlaying(false);
              setIsPaused(false);
              setShowTutorial(false);
              setTutorialStep(0);
              // Clear interval
              if (dataInterval) {
                clearInterval(dataInterval);
                setDataInterval(null);
              }
              router.back();
            }
          }
        ]
      );
    } else {
      router.back();
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsPlaying(false);
    if (dataInterval) {
      clearInterval(dataInterval);
      setDataInterval(null);
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    setIsPlaying(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={handleExit} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>{portfolioName}</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setShowHelp(true)} style={styles.helpButton}>
            <Ionicons name="help-circle-outline" size={24} color={theme.primary} />
          </Pressable>
          {isPlaying && (
            <Pressable onPress={handleExit} style={styles.exitButton}>
              <Ionicons name="stop-circle-outline" size={24} color={theme.danger} />
            </Pressable>
          )}
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <Card style={styles.balanceCard} elevation="med">
          <View style={styles.balanceRow}>
            <View style={{ flex: 1 }}>
              <Text variant="small" muted>
                {mode === 'beginner' ? 'Cash Available' : 'Balance'}
              </Text>
              <Text variant="h2" weight="bold">${balance.toFixed(2)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small" muted>
                {mode === 'beginner' ? 'Profit/Loss' : 'P&L'}
              </Text>
              <Text 
                variant="h3" 
                weight="bold"
                color={pnl >= 0 ? theme.success : theme.danger}
              >
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small" muted>
                {mode === 'beginner' ? 'Open Trades' : 'Positions'}
              </Text>
              <Text variant="h3" weight="bold">{positions.length}</Text>
            </View>
          </View>
        </Card>

        {/* Symbol Selector */}
        {symbols.length > 1 && (
          <Card style={styles.symbolSelector}>
            <Text variant="small" muted>Trading</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.symbolButtons}>
                {symbols.map(symbol => (
                  <Pressable
                    key={symbol}
                    onPress={() => setCurrentSymbol(symbol)}
                  >
                    <Badge
                      variant={currentSymbol === symbol ? 'primary' : 'secondary'}
                      size="medium"
                    >
                      {symbol}
                    </Badge>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Card>
        )}

        {/* Price Chart - Simplified for beginners */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text variant="h3" weight="bold">{currentSymbol}</Text>
              <Text variant="small" muted>Current Price</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="h2" weight="bold" color={theme.primary}>
                ${currentPrice.toFixed(2)}
              </Text>
              {priceHistory.length > 1 && (
                <Badge 
                  variant={currentPrice >= priceHistory[priceHistory.length - 2] ? 'success' : 'danger'}
                  size="small"
                >
                  {currentPrice >= priceHistory[priceHistory.length - 2] ? '↑' : '↓'}
                  {Math.abs(((currentPrice - priceHistory[priceHistory.length - 2]) / priceHistory[priceHistory.length - 2]) * 100).toFixed(2)}%
                </Badge>
              )}
            </View>
          </View>

          {/* Price Chart */}
          {mode === 'beginner' && (
            <Text variant="xs" muted center style={styles.chartLabel}>
              📈 Green = Price Going UP | 📉 Red = Price Going DOWN
            </Text>
          )}
          
          {chartData.length > 0 && (
            <CandlestickChart
              data={chartData}
              chartType="daily"
              beginnerMode={mode === 'beginner'}
              showTooltip={true}
            />
          )}
        </Card>

        {/* Beginner Tips */}
        {mode === 'beginner' && !showTutorial && (
          <Card style={StyleSheet.flatten([styles.tipCard, { backgroundColor: theme.primary + '10' }])}>
            <Ionicons name="bulb" size={24} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold" color={theme.primary}>Quick Tip</Text>
              <Text variant="small" muted>
                {positions.length === 0 
                  ? 'Buy when you think the price will go UP. You can always sell later!'
                  : 'You have open positions. Sell when you want to lock in profits or cut losses.'}
              </Text>
            </View>
          </Card>
        )}

        {/* Trading Actions */}
        <Card style={styles.actionsCard}>
          <Text variant="h3" weight="semibold">
            {mode === 'beginner' ? 'What would you like to do?' : 'Trading Actions'}
          </Text>
          {mode === 'beginner' && (
            <Text variant="xs" muted>
              Buy when you think the price will go up. Sell to close and lock in profits/losses.
            </Text>
          )}
          
          <View style={styles.actionButtons}>
            <Button
              variant="primary"
              size="large"
              onPress={handleBuy}
              disabled={!isPlaying}
              icon={<Ionicons name="arrow-up" size={24} color="#FFFFFF" />}
              style={{ flex: 1 }}
            >
              {mode === 'beginner' ? 'Enter Trade' : 'Buy'}
            </Button>
            
            <Button
              variant="danger"
              size="large"
              onPress={handleSell}
              disabled={!isPlaying || positions.length === 0}
              icon={<Ionicons name="arrow-down" size={24} color="#FFFFFF" />}
              style={{ flex: 1 }}
            >
              {mode === 'beginner' ? 'Exit Trade' : 'Sell'}
            </Button>
          </View>

          {!isPlaying && !showTutorial && !isPaused && (
            <Button
              variant="primary"
              size="medium"
              onPress={() => setIsPlaying(true)}
              icon={<Ionicons name="play" size={20} color={theme.bg} />}
              fullWidth
            >
              Start Game
            </Button>
          )}

          {/* Pause/Resume Controls */}
          {isPlaying && !isPaused && (
            <Pressable 
              onPress={handlePause}
              style={[styles.endGameButton, { backgroundColor: (theme.warning || '#F59E0B') + '20', borderColor: theme.warning || '#F59E0B' }]}
            >
              <Ionicons name="pause-circle" size={20} color={theme.warning || '#F59E0B'} />
              <Text variant="body" weight="semibold" color={theme.warning || '#F59E0B'}>
                Pause
              </Text>
            </Pressable>
          )}

          {isPaused && (
            <View style={styles.pauseControls}>
              <Button
                variant="primary"
                size="medium"
                onPress={handleResume}
                icon={<Ionicons name="play" size={20} color={theme.bg} />}
                style={{ flex: 1 }}
              >
                Resume
              </Button>
              <Pressable 
                onPress={handleExit}
                style={[styles.endGameButton, { backgroundColor: theme.danger + '20', borderColor: theme.danger, flex: 1 }]}
              >
                <Ionicons name="stop-circle" size={20} color={theme.danger} />
                <Text variant="body" weight="semibold" color={theme.danger}>
                  End
                </Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* Positions List */}
        {positions.length > 0 && (
          <Card style={styles.positionsCard}>
            <Text variant="h3" weight="semibold">Your Positions</Text>
            
            {positions.map((position, index) => {
              const positionPnL = (currentPrice - position.entryPrice) * position.quantity;
              return (
                <Card key={index} style={styles.positionItem} elevation="low">
                  <View style={styles.positionHeader}>
                    <Badge variant="primary" size="medium">{position.symbol}</Badge>
                    <Badge 
                      variant={positionPnL >= 0 ? 'success' : 'danger'} 
                      size="small"
                    >
                      {positionPnL >= 0 ? '+' : ''}${positionPnL.toFixed(2)}
                    </Badge>
                  </View>
                  <View style={styles.positionDetails}>
                    <Text variant="small" muted>Qty: {position.quantity}</Text>
                    <Text variant="small" muted>Entry: ${position.entryPrice.toFixed(2)}</Text>
                    <Text variant="small" muted>Current: ${currentPrice.toFixed(2)}</Text>
                  </View>
                </Card>
              );
            })}
          </Card>
        )}

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>

      {/* Tutorial Modal */}
      <Modal
        visible={showTutorial}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Card style={styles.tutorialModal} elevation="high">
              <View style={[styles.tutorialIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name={currentTutorial.icon as any} size={48} color={theme.primary} />
              </View>
              
              <Text variant="h2" weight="bold" center>
                {currentTutorial.title}
              </Text>
              
              <Text variant="body" center muted>
                {currentTutorial.description}
              </Text>
              
              <View style={styles.tutorialProgress}>
                {TUTORIAL_STEPS.map((_, index) => (
                  <View 
                    key={index}
                    style={[
                      styles.progressDot,
                      { 
                        backgroundColor: index === tutorialStep ? theme.primary : theme.border 
                      }
                    ]} 
                  />
                ))}
              </View>
              
              <View style={styles.tutorialActions}>
                <Button
                  variant="ghost"
                  size="medium"
                  onPress={skipTutorial}
                >
                  Skip Tutorial
                </Button>
                
                <Button
                  variant="primary"
                  size="medium"
                  onPress={nextTutorialStep}
                  icon={<Ionicons name={tutorialStep < TUTORIAL_STEPS.length - 1 ? "arrow-forward" : "checkmark"} size={20} color={theme.bg} />}
                >
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Start Trading!'}
                </Button>
              </View>
            </Card>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        visible={showHelp}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelp(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowHelp(false)}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: tokens.spacing.md }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Card style={styles.helpModal} elevation="high">
                <Text variant="h2" weight="bold">Help & Tips</Text>
                
                <View style={styles.helpItem}>
                  <Ionicons name="trending-up" size={24} color={theme.success} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">Buying</Text>
                    <Text variant="small" muted>
                      Buy when you think the price will increase. You profit when you sell at a higher price.
                    </Text>
                  </View>
                </View>
                
                <View style={styles.helpItem}>
                  <Ionicons name="trending-down" size={24} color={theme.danger} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">Selling</Text>
                    <Text variant="small" muted>
                      Sell to close your position and lock in profits or cut losses.
                    </Text>
                  </View>
                </View>
                
                <View style={styles.helpItem}>
                  <Ionicons name="wallet" size={24} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" weight="semibold">P&L (Profit & Loss)</Text>
                    <Text variant="small" muted>
                      Shows how much you're winning or losing on your current positions.
                    </Text>
                  </View>
                </View>
                
                <Button
                  variant="primary"
                  size="medium"
                  onPress={() => setShowHelp(false)}
                  fullWidth
                >
                  Got it!
                </Button>
              </Card>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
      
      <FAB onPress={() => router.push('/ai-chat')} />
      
      {/* Save & Exit and Complete Buttons - Fixed positioning */}
      {(isPlaying || isPaused) && (
        <View style={styles.saveExitContainer}>
          <Pressable 
            onPress={saveGameSession}
            style={[styles.saveExitButton, { backgroundColor: theme.surface, borderColor: theme.primary }]}
          >
            <Ionicons name="save-outline" size={18} color={theme.primary} />
            <Text variant="small" weight="semibold" color={theme.primary}>
              Save & Exit
            </Text>
          </Pressable>
          <Pressable 
            onPress={completeGameSession}
            style={[styles.completeButton, { backgroundColor: theme.primary }]}
          >
            <Text variant="small" weight="semibold" color="#FFFFFF">
              Complete
            </Text>
            <View style={[styles.completeIcon, { backgroundColor: theme.primary + '40' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      )}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  helpButton: {
    padding: tokens.spacing.xs,
  },
  exitButton: {
    padding: tokens.spacing.xs,
  },
  endGameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
  },
  pauseControls: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: tokens.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  balanceCard: {
    gap: tokens.spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  symbolSelector: {
    gap: tokens.spacing.xs,
  },
  symbolButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  chartCard: {
    gap: tokens.spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartContainer: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  chartLabel: {
    marginBottom: tokens.spacing.xs,
  },
  chartArea: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  chartBar: {
    flex: 1,
    borderRadius: 2,
  },
  tipCard: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    alignItems: 'flex-start',
  },
  actionsCard: {
    gap: tokens.spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  positionsCard: {
    gap: tokens.spacing.md,
  },
  positionItem: {
    gap: tokens.spacing.sm,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tutorialModal: {
    margin: tokens.spacing.md,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    alignItems: 'center',
  },
  tutorialIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialProgress: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tutorialActions: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    width: '100%',
  },
  helpModal: {
    gap: tokens.spacing.md,
  },
  helpItem: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    alignItems: 'flex-start',
  },
  saveExitContainer: {
    position: 'absolute',
    bottom: tokens.spacing.lg,
    left: tokens.spacing.md,
    right: tokens.spacing.md,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    zIndex: 10,
  },
  saveExitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    flex: 1,
    position: 'relative',
  },
  completeIcon: {
    position: 'absolute',
    right: tokens.spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

