/**
 * Historical Trade Simulator
 * Practice trading on historical data with playback controls
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, FAB, tokens } from '@/src/design-system';
import { SimulationProvider, useSimulation } from '@/contexts/SimulationContext';
import { TRADING_SYMBOLS, getHistoricalData } from '@/data/historicalData';
import { PlaybackControls } from '@/components/trade/PlaybackControls';
import { TradeLogPanel } from '@/components/trade/TradeLogPanel';
import { TradeActions } from '@/components/trade/TradeActions';
import { DurationSlider } from '@/components/trade/DurationSlider';
import { SimpleCandlestickChart } from '@/components/trade/SimpleCandlestickChart';
import { ResultModal } from '@/components/trade/ResultModal';

function TradeSimulatorContent() {
  const router = useRouter();
  const { theme } = useTheme();
  const simulation = useSimulation();

  const [selectedSymbol, setSelectedSymbol] = useState(TRADING_SYMBOLS[0]);
  const [duration, setDuration] = useState(30);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [showResults, setShowResults] = useState(false);

  // Listen for simulation completion
  useEffect(() => {
    if (simulation.playbackState === 'completed' && !isSetupMode) {
      setShowResults(true);
    }
  }, [simulation.playbackState, isSetupMode]);

  const handleStartSimulation = () => {
    // Generate historical data
    const candles = getHistoricalData(selectedSymbol.symbol, duration);
    
    // Initialize simulation
    simulation.initializeSimulation(candles, selectedSymbol.symbol, duration);
    
    // Switch to trading mode
    setIsSetupMode(false);
    
    // Auto-start playback
    setTimeout(() => simulation.play(), 500);
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
          title: 'Trade Simulator',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerLeft: () => (
            <Pressable onPress={handleGoBack} style={{ marginLeft: 16 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      
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
              <Text variant="h3" weight="semibold">Select Symbol</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
                style={styles.symbolScroll}
                contentContainerStyle={styles.symbolContent}
              >
                {TRADING_SYMBOLS.map((symbol) => (
                  <Pressable
                    key={symbol.symbol}
                    onPress={() => setSelectedSymbol(symbol)}
              >
                <Card
                      style={StyleSheet.flatten([
                        styles.symbolCard,
                        selectedSymbol.symbol === symbol.symbol && {
                          borderColor: theme.primary,
                          borderWidth: 2,
                          backgroundColor: theme.primary + '10'
                        }
                      ])}
                    >
                      <Text variant="body" weight="bold">{symbol.symbol}</Text>
                      <Text variant="xs" muted>{symbol.name}</Text>
                      <Text variant="small" weight="semibold" color={theme.primary}>
                        ${symbol.basePrice.toLocaleString()}
                      </Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
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
                <Text variant="body" weight="semibold">How it works:</Text>
                <Text variant="small" muted>
                  • Select your preferred trading symbol{'\n'}
                  • Choose simulation duration{'\n'}
                  • Trade in real-time as price moves{'\n'}
                  • Use playback controls to pause/rewind{'\n'}
                  • Review your performance at the end
                </Text>
              </View>
            </Card>
          </>
        ) : (
          // Trading Mode
          <>
            {/* Status Bar */}
            <Card style={styles.statusBar}>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Symbol</Text>
                <Badge variant="primary" size="medium">{simulation.symbol}</Badge>
              </View>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Balance</Text>
                <Text variant="body" weight="bold">${simulation.userBalance.toFixed(2)}</Text>
              </View>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>P&L</Text>
              <Text 
                variant="body" 
                weight="bold"
                  color={simulation.userPnL >= 0 ? theme.success : theme.danger}
                >
                  {simulation.userPnL >= 0 ? '+' : ''}${simulation.userPnL.toFixed(2)}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text variant="xs" muted>Positions</Text>
                <Badge variant="primary" size="small">{simulation.userPositions.length}</Badge>
              </View>
            </Card>

            {/* Chart */}
            <Card style={styles.chartCard}>
              <SimpleCandlestickChart
                candles={simulation.engine?.getVisibleCandles(50) || []}
                height={300}
                showVolume={false}
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
              <Text variant="body" weight="semibold">Place Trade</Text>
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
      
      <FAB onPress={() => router.push('/ai-chat')} />
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
  },
  tradeActionsCard: {
    gap: tokens.spacing.sm,
  },
});
