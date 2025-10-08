/**
 * User vs AI Battle - Play Screen
 * Live trading competition against AI
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Badge, tokens, HumanAvatar, RobotAvatar } from '@/src/design-system';
import { SimulationProvider, useSimulation } from '@/contexts/SimulationContext';
import { getHistoricalData } from '@/data/historicalData';
import { PlaybackControls } from '@/components/trade/PlaybackControls';
import { TradeLogPanel } from '@/components/trade/TradeLogPanel';
import { TradeActions } from '@/components/trade/TradeActions';
import { SimpleCandlestickChart } from '@/components/trade/SimpleCandlestickChart';
import { StatusIndicator } from '@/components/trade/StatusIndicator';
import { AITrader } from '@/utils/aiTrader';

function VsAIPlayContent() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ symbol?: string; duration?: string }>();
  const simulation = useSimulation();
  
  const [initialized, setInitialized] = useState(false);
  const aiTraderRef = useRef(new AITrader('momentum'));
  const lastAITickRef = useRef(-1);

  // Initialize simulation
  useEffect(() => {
    if (initialized) return;

    const symbol = params.symbol || 'BTC/USD';
    const duration = parseInt(params.duration || '15');

    // Generate historical data
    const candles = getHistoricalData(symbol, duration);
    
    // Initialize simulation
    simulation.initializeSimulation(candles, symbol, duration);
    simulation.setAiEnabled(true);
    
    // Reset AI
    aiTraderRef.current.reset();
    aiTraderRef.current.setTradeFrequency(0.4); // AI trades more frequently
    
    setInitialized(true);
    
    // Auto-start after short delay
    setTimeout(() => simulation.play(), 1000);
  }, [initialized, params.symbol, params.duration, simulation, router]);

  // AI Trading Logic
  useEffect(() => {
    if (!simulation.currentCandle || !simulation.aiEnabled) return;
    if (simulation.currentIndex === lastAITickRef.current) return;
    if (simulation.playbackState !== 'playing') return;

    lastAITickRef.current = simulation.currentIndex;

    // Get previous candles for AI analysis
    const previousCandles = simulation.engine?.getVisibleCandles(20) || [];
    if (previousCandles.length < 10) return;

    // Make AI decision
    const decision = aiTraderRef.current.makeDecision(
      simulation.currentCandle,
      previousCandles.slice(0, -1), // All except current
      simulation.currentIndex,
      simulation.aiBalance,
      simulation.aiPositions
    );

    // Execute AI decision
    if (decision.action === 'buy') {
      executeAIBuy(decision.quantity, decision.reason);
    } else if (decision.action === 'sell') {
      executeAISell(decision.quantity, decision.reason);
    } else if (decision.action === 'close') {
      closeAllAIPositions(decision.reason);
    }
  }, [simulation.currentCandle, simulation.currentIndex, simulation.playbackState]);

  // Execute AI Buy
  const executeAIBuy = (quantity: number, reason: string) => {
    simulation.executeAITrade('buy', quantity, reason);
  };

  // Execute AI Sell
  const executeAISell = (quantity: number, reason: string) => {
    simulation.executeAITrade('sell', quantity, reason);
  };

  // Close all AI positions
  const closeAllAIPositions = (reason: string) => {
    if (simulation.aiPositions.length === 0) return;

    simulation.addEvent({
      type: 'ai_sell',
      message: `AI: ${reason} - Closed all positions`,
      trader: 'ai'
    });
  };

  // Handle match completion
  useEffect(() => {
    if (simulation.playbackState === 'completed' && initialized) {
      setTimeout(() => {
        router.replace({
          pathname: '/vs-ai-gameover',
          params: {
            symbol: simulation.symbol,
            userPnL: simulation.userPnL.toFixed(2),
            aiPnL: simulation.aiPnL.toFixed(2),
            userBalance: simulation.userBalance.toFixed(2),
            aiBalance: simulation.aiBalance.toFixed(2),
            userTrades: simulation.userTrades.length.toString(),
            aiTrades: simulation.aiTrades.length.toString()
          }
        });
      }, 2000);
    }
  }, [simulation.playbackState, initialized]);

  const handleExit = () => {
    Alert.alert(
      'Exit Match?',
      'The match is still in progress. Are you sure you want to exit?',
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
  };

  if (!initialized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.loading}>
          <Ionicons name="hourglass" size={48} color={theme.primary} />
          <Text variant="h3" weight="bold">Initializing Match...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'User vs AI - Live',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerLeft: () => (
            <Pressable onPress={handleExit} style={{ marginLeft: 16 }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Battle Status */}
        <Card style={styles.battleHeader}>
          <Text variant="h3" weight="bold" center>Live Battle</Text>
          <Badge variant="primary" size="large">{simulation.symbol}</Badge>
          <StatusIndicator 
            status={simulation.playbackState === 'playing' ? 'active' : 'paused'} 
          />
        </Card>

        {/* Scoreboard */}
        <View style={styles.scoreboard}>
          {/* User Score */}
          <Card style={[styles.scoreCard, { borderColor: theme.primary, borderWidth: 2 }]}>
            <View style={styles.scoreHeader}>
              <HumanAvatar size={32} />
              <Text variant="body" weight="semibold">You</Text>
            </View>
            <Text variant="h2" weight="bold" color={simulation.userPnL >= 0 ? theme.success : theme.danger}>
              {simulation.userPnL >= 0 ? '+' : ''}${simulation.userPnL.toFixed(2)}
            </Text>
            <Text variant="xs" muted>P&L</Text>
            <View style={styles.scoreStats}>
              <View>
                <Text variant="xs" muted>Balance</Text>
                <Text variant="small" weight="semibold">${simulation.userBalance.toFixed(0)}</Text>
              </View>
              <View>
                <Text variant="xs" muted>Trades</Text>
                <Text variant="small" weight="semibold">{simulation.userTrades.length}</Text>
        </View>
              <View>
                <Text variant="xs" muted>Positions</Text>
                <Text variant="small" weight="semibold">{simulation.userPositions.length}</Text>
        </View>
      </View>
          </Card>

          {/* AI Score */}
          <Card style={[styles.scoreCard, { borderColor: theme.accent, borderWidth: 2 }]}>
            <View style={styles.scoreHeader}>
              <RobotAvatar size={32} />
              <Text variant="body" weight="semibold">AI</Text>
            </View>
            <Text variant="h2" weight="bold" color={simulation.aiPnL >= 0 ? theme.success : theme.danger}>
              {simulation.aiPnL >= 0 ? '+' : ''}${simulation.aiPnL.toFixed(2)}
            </Text>
            <Text variant="xs" muted>P&L</Text>
            <View style={styles.scoreStats}>
              <View>
                <Text variant="xs" muted>Balance</Text>
                <Text variant="small" weight="semibold">${simulation.aiBalance.toFixed(0)}</Text>
              </View>
              <View>
                <Text variant="xs" muted>Trades</Text>
                <Text variant="small" weight="semibold">{simulation.aiTrades.length}</Text>
              </View>
              <View>
                <Text variant="xs" muted>Positions</Text>
                <Text variant="small" weight="semibold">{simulation.aiPositions.length}</Text>
              </View>
          </View>
          </Card>
        </View>

        {/* Chart */}
        <Card style={styles.chartCard}>
          <SimpleCandlestickChart
            candles={simulation.engine?.getVisibleCandles(50) || []}
            height={250}
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
        />

        {/* Trade Actions */}
        <Card style={styles.tradeActionsCard} elevation="med">
          <Text variant="body" weight="semibold">Your Actions</Text>
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
          maxHeight={200}
        />

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function VsAIPlay() {
  return (
    <SimulationProvider>
      <VsAIPlayContent />
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  battleHeader: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  scoreboard: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  scoreCard: {
    flex: 1,
    gap: tokens.spacing.sm,
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  scoreStats: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000010',
    width: '100%',
    justifyContent: 'space-around',
  },
  chartCard: {
    padding: tokens.spacing.sm,
  },
  tradeActionsCard: {
    gap: tokens.spacing.sm,
  },
});

