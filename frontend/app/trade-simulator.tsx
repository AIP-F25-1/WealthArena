/**
 * Historical Trade Simulator
 * Practice trading on historical data with playback controls
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, FAB as Fab, tokens } from '@/src/design-system';
import { SimulationProvider, useSimulation } from '@/contexts/SimulationContext';
import { getHistoricalData } from '@/data/historicalData';
import { PlaybackControls } from '@/components/trade/PlaybackControls';
import { TradeLogPanel } from '@/components/trade/TradeLogPanel';
import { TradeActions } from '@/components/trade/TradeActions';
import { DurationSlider } from '@/components/trade/DurationSlider';
import CandlestickChart from '@/components/CandlestickChart';
import { ResultModal } from '@/components/trade/ResultModal';
import { marketDataService } from '@/services/marketDataService';

interface TradingSymbol {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
}

function TradeSimulatorContent() {
  const router = useRouter();
  const { theme } = useTheme();
  const simulation = useSimulation();

  const [availableSymbols, setAvailableSymbols] = useState<TradingSymbol[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [selectedSymbols, setSelectedSymbols] = useState<TradingSymbol[]>([]);
  const [currentSymbol, setCurrentSymbol] = useState<TradingSymbol | null>(null);
  const [duration, setDuration] = useState(30);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [showResults, setShowResults] = useState(false);

  // Load real symbols from backend
  useEffect(() => {
    const loadSymbols = async () => {
      setIsLoadingSymbols(true);
      try {
        console.log('Loading trading symbols from backend...');
        const symbols = await marketDataService.getAvailableSymbols();
        
        if (symbols && symbols.length > 0) {
          // Convert to TradingSymbol format with default prices
          const tradingSymbols: TradingSymbol[] = symbols.slice(0, 20).map((symbol) => {
            // Get base price from market data if available
            const basePrice = 100; // Default, will be updated when data is fetched
            const volatility = symbol.includes('=') || symbol.includes('-USD') ? 0.03 : 0.02;
            
            return {
              symbol,
              name: symbol,
              basePrice,
              volatility
            };
          });
          
          setAvailableSymbols(tradingSymbols);
          if (tradingSymbols.length > 0) {
            setSelectedSymbols([tradingSymbols[0]]);
            setCurrentSymbol(tradingSymbols[0]);
          }
          console.log(`✓ Loaded ${tradingSymbols.length} real symbols for trade simulator`);
        } else {
          console.warn('No symbols available from backend');
        }
      } catch (error) {
        console.error('Error loading symbols for trade simulator:', error);
      } finally {
        setIsLoadingSymbols(false);
      }
    };
    
    loadSymbols();
  }, []);

  // Safely compute previous close for change badge without optional chaining pitfalls
  const previousTwoCandles = simulation.engine?.getVisibleCandles(2) ?? [];
  const previousClose = previousTwoCandles.length > 1 ? previousTwoCandles[0].close : undefined;

  // Listen for simulation completion
  useEffect(() => {
    if (simulation.playbackState === 'completed' && !isSetupMode) {
      setShowResults(true);
    }
  }, [simulation.playbackState, isSetupMode]);

  const handleStartSimulation = async () => {
    if (!currentSymbol) {
      Alert.alert('Error', 'Please select a symbol first');
      return;
    }
    
    try {
      // Fetch real historical data from backend
      const { resolveBackendURL } = await import('@/utils/networkConfig');
      const { getAuthHeaders } = await import('@/services/apiService');
      const backendUrl = await resolveBackendURL(3000);
      
      const response = await fetch(
        `${backendUrl}/api/market-data/history/${currentSymbol.symbol}?period=${duration}d&days=${duration}`,
        {
          headers: await getAuthHeaders(),
        }
      );
      
      let candles: any[] = [];
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          // Convert backend format to CandleData format
          candles = result.data.map((candle: any) => {
            const time = new Date(candle.time || candle.Date);
            return {
              timestamp: time.getTime(),
              open: candle.open || candle.Open,
              high: candle.high || candle.High,
              low: candle.low || candle.Low,
              close: candle.close || candle.Close,
              volume: candle.volume || candle.Volume || 0
            };
          });
        }
      }
      
      // If no data from backend, fall back to generated data
      if (candles.length === 0) {
        console.warn(`No data for ${currentSymbol.symbol}, using generated data`);
        candles = getHistoricalData(currentSymbol.symbol, duration);
      }
      
      // Initialize simulation
      simulation.initializeSimulation(candles, currentSymbol.symbol, duration);
      
      // Switch to trading mode
      setIsSetupMode(false);
      
      // Auto-start playback
      setTimeout(() => simulation.play(), 500);
    } catch (error) {
      console.error('Error starting simulation:', error);
      Alert.alert('Error', 'Failed to load market data. Please try again.');
    }
  };

  const toggleSymbol = (symbol: TradingSymbol) => {
    const isSelected = selectedSymbols.some(s => s.symbol === symbol.symbol);
    if (isSelected) {
      if (selectedSymbols.length === 1) {
        Alert.alert('Cannot Remove', 'You must select at least one symbol');
        return;
      }
      setSelectedSymbols(selectedSymbols.filter(s => s.symbol !== symbol.symbol));
      if (currentSymbol?.symbol === symbol.symbol) {
        setCurrentSymbol(selectedSymbols[0]);
      }
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const handlePlayAgain = () => {
    setShowResults(false);
    setIsSetupMode(true);
    simulation.destroySimulation();
  };

  const handleGoBack = () => {
    if (!isSetupMode) {
      Alert.alert(
        'Exit Simulation?',
        'Your progress will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Exit', 
            style: 'destructive',
            onPress: () => {
              simulation.destroySimulation();
              router.back();
            }
          }
        ]
      );
    } else {
      router.back();
    }
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
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Trade Simulator</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isSetupMode ? (
          // Setup Mode
          <>
        <Card style={styles.headerCard} elevation="med">
              <Ionicons name="time-outline" size={48} color={theme.primary} />
              <Text variant="h2" weight="bold" center>Historical Trading Simulator</Text>
              <Text variant="body" muted center>
                Practice with real market patterns, risk-free
          </Text>
        </Card>

            {/* Symbol Selection */}
            <Card style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="h3" weight="semibold">Select Symbols</Text>
                <Badge variant="primary" size="medium">{selectedSymbols.length} selected</Badge>
              </View>
              <Text variant="small" muted>
                Choose one or more instruments to trade (tap to select/deselect)
              </Text>
              {isLoadingSymbols ? (
                <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
                  <Text variant="body" muted>Loading symbols from database...</Text>
                </View>
              ) : availableSymbols.length === 0 ? (
                <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
                  <Text variant="body" muted>No symbols available. Please ensure backend has loaded market data.</Text>
                </View>
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.symbolScroll}
                  contentContainerStyle={styles.symbolContent}
                >
                  {availableSymbols.map((symbol) => {
                    const isSelected = selectedSymbols.some(s => s.symbol === symbol.symbol);
                    return (
                      <Pressable
                        key={symbol.symbol}
                        onPress={() => toggleSymbol(symbol)}
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
                        >
                          {isSelected && (
                            <View style={{ position: 'absolute', top: 8, right: 8 }}>
                              <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                            </View>
                          )}
                          <Text variant="body" weight="bold">{symbol.symbol}</Text>
                          <Text variant="xs" muted>{symbol.name}</Text>
                          <Text variant="small" weight="semibold" color={theme.primary}>
                            ${symbol.basePrice.toLocaleString()}
                          </Text>
                        </Card>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </Card>

            {/* Duration Selection */}
            <Card style={styles.sectionCard}>
              <DurationSlider
                value={duration}
                onChange={setDuration}
                min={5}
                max={60}
              />
              <Text variant="xs" muted center>
                {duration * 60} candles will be simulated
              </Text>
            </Card>

            {/* Start Button */}
            <Button
              variant="primary"
              size="large"
              fullWidth
              onPress={handleStartSimulation}
              icon={<Ionicons name="play-circle" size={24} color={theme.bg} />}
            >
              Start Simulation
            </Button>

            {/* Info Card */}
            <Card style={StyleSheet.flatten([styles.infoCard, { backgroundColor: theme.primary + '10' }])}>
              <Ionicons name="information-circle" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold" color={theme.primary}>
                  How it works:
                </Text>
                <Text variant="small" muted style={{ marginTop: tokens.spacing.xs }}>
                  • Select one or more trading symbols{'\n'}
                  • Choose how long to simulate (5-60 minutes){'\n'}
                  • Enter Trade when you think price will go UP{'\n'}
                  • Exit Trade to lock in profits or cut losses{'\n'}
                  • Use play/pause controls to learn at your pace{'\n'}
                  • Review your results at the end
                </Text>
              </View>
            </Card>
            
            {/* Beginner Tip */}
            <Card style={StyleSheet.flatten([styles.tipCard, { backgroundColor: theme.accent + '10' }])}>
              <Ionicons name="bulb" size={20} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text variant="small" weight="bold" color={theme.accent}>
                  Beginner Tip:
                </Text>
                <Text variant="xs" muted>
                  Start with just one symbol and a short duration (5-10 minutes) to learn the basics!
                </Text>
              </View>
            </Card>
          </>
        ) : (
          // Trading Mode
          <>
            {/* Symbol Switcher */}
            {selectedSymbols.length > 1 && (
              <Card style={styles.symbolSwitcher}>
                <Text variant="xs" muted>Trading</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: tokens.spacing.xs }}>
                    {selectedSymbols.map((symbol) => (
                      <Pressable
                        key={symbol.symbol}
                        onPress={async () => {
                          setCurrentSymbol(symbol);
                          try {
                            const { resolveBackendURL } = await import('@/utils/networkConfig');
                            const { getAuthHeaders } = await import('@/services/apiService');
                            const backendUrl = await resolveBackendURL(3000);
                            
                            const response = await fetch(
                              `${backendUrl}/api/market-data/history/${symbol.symbol}?period=${duration}d&days=${duration}`,
                              { headers: await getAuthHeaders() }
                            );
                            
                            let candles: any[] = [];
                            if (response.ok) {
                              const result = await response.json();
                              if (result.success && result.data && result.data.length > 0) {
                                candles = result.data.map((candle: any) => {
                                  const time = new Date(candle.time || candle.Date);
                                  return {
                                    timestamp: time.getTime(),
                                    open: candle.open || candle.Open,
                                    high: candle.high || candle.High,
                                    low: candle.low || candle.Low,
                                    close: candle.close || candle.Close,
                                    volume: candle.volume || candle.Volume || 0
                                  };
                                });
                              }
                            }
                            
                            if (candles.length === 0) {
                              candles = getHistoricalData(symbol.symbol, duration);
                            }
                            
                            simulation.initializeSimulation(candles, symbol.symbol, duration);
                            simulation.play();
                          } catch (error) {
                            console.error('Error loading symbol data:', error);
                            const candles = getHistoricalData(symbol.symbol, duration);
                            simulation.initializeSimulation(candles, symbol.symbol, duration);
                            simulation.play();
                          }
                        }}
                      >
                        <Badge
                          variant={currentSymbol?.symbol === symbol.symbol ? 'primary' : 'secondary'}
                          size="medium"
                        >
                          {symbol.symbol}
                        </Badge>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </Card>
            )}

            {/* Status Bar */}
            <Card style={styles.statusBar} elevation="med">
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Trading</Text>
                <Badge variant="primary" size="medium">{simulation.symbol}</Badge>
              </View>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Cash</Text>
                <Text variant="body" weight="bold">${simulation.userBalance.toFixed(2)}</Text>
              </View>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Profit/Loss</Text>
              <Text 
                variant="body" 
                weight="bold"
                  color={simulation.userPnL >= 0 ? theme.success : theme.danger}
                >
                  {simulation.userPnL >= 0 ? '+' : ''}${simulation.userPnL.toFixed(2)}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Open</Text>
                <Badge 
                  variant={simulation.userPositions.length > 0 ? 'success' : 'secondary'} 
                  size="small"
                >
                  {simulation.userPositions.length}
                </Badge>
              </View>
            </Card>

            {/* Chart */}
            <Card style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text variant="h3" weight="bold">{currentSymbol.symbol}</Text>
                  <Text variant="small" muted>Current Price</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="h2" weight="bold" color={theme.primary}>
                    ${simulation.currentCandle?.close?.toFixed(2) || '0.00'}
                  </Text>
                  {previousClose !== undefined && simulation.currentCandle?.close !== undefined && (
                    <Badge
                      variant={simulation.currentCandle.close >= previousClose ? 'success' : 'danger'}
                      size="small"
                    >
                      {simulation.currentCandle.close >= previousClose ? '↑' : '↓'}
                      {Math.abs(((simulation.currentCandle.close - previousClose) / previousClose) * 100).toFixed(2)}%
                    </Badge>
                  )}
                </View>
              </View>

              {/* Price Chart */}
              <Text variant="xs" muted center style={styles.chartLabel}>
                📈 Green = Price Going UP | 📉 Red = Price Going DOWN
              </Text>

              <CandlestickChart
                data={(simulation.engine?.getVisibleCandles(50) || []).map((c) => ({
                  time: new Date(c.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                }))}
                chartType="daily"
                beginnerMode={true}
                showTooltip={true}
              />
            </Card>

            {/* Playback Controls */}
            <PlaybackControls
              playbackState={simulation.playbackState}
              playbackSpeed={simulation.playbackSpeed}
              progress={simulation.progress}
              currentIndex={simulation.currentIndex}
              totalCandles={simulation.totalCandles}
              onPlay={simulation.play}
              onPause={simulation.pause}
              onRewind={simulation.rewind}
              onFastForward={simulation.fastForward}
              onSpeedChange={simulation.setSpeed}
              onReset={simulation.reset}
            />

            {/* Trade Actions */}
            <Card style={styles.tradeActionsCard} elevation="med">
              <View style={styles.tradeHeader}>
                <Text variant="h3" weight="semibold">Trade Actions</Text>
                <Text variant="xs" muted>
                  Current: ${(simulation.currentCandle?.close || 0).toFixed(2)}
                </Text>
              </View>
              <Text variant="xs" muted style={{ marginBottom: tokens.spacing.xs }}>
                💡 Enter when you think price will rise. Exit to lock in profits/losses.
              </Text>
              <TradeActions
                currentPrice={simulation.currentCandle?.close || 0}
                balance={simulation.userBalance}
                hasOpenPositions={simulation.userPositions.length > 0}
                onBuy={simulation.executeBuy}
                onSell={simulation.executeSell}
                onCloseAll={simulation.closeAllPositions}
                disabled={simulation.playbackState === 'completed'}
              />
            </Card>

            {/* Trade Log */}
            <TradeLogPanel
              events={simulation.events}
              maxHeight={250}
            />
          </>
        )}

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>

      {/* Result Modal */}
      <ResultModal
        visible={showResults}
        onClose={() => setShowResults(false)}
        onPlayAgain={handlePlayAgain}
        mode="simulator"
        userPnL={simulation.userPnL}
        userBalance={simulation.userBalance}
        userTrades={simulation.userTrades.length}
      />
      
      <Fab onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}

export default function TradeSimulatorScreen() {
  return (
    <SimulationProvider>
      <TradeSimulatorContent />
    </SimulationProvider>
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
    width: 40,
  },
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.lg,
  },
  sectionCard: {
    gap: tokens.spacing.md,
  },
  symbolScroll: {
    marginVertical: tokens.spacing.xs,
  },
  symbolContent: {
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  symbolCard: {
    minWidth: 120,
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    alignItems: 'flex-start',
  },
  tipCard: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    alignItems: 'flex-start',
  },
  symbolSwitcher: {
    gap: tokens.spacing.xs,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  statusItem: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  chartCard: {
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.xs,
  },
  chartLabel: {
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  tradeActionsCard: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
