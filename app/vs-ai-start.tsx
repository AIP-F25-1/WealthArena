/**
 * User vs AI Battle - Start Screen
 * Setup screen for AI trading competition
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, tokens, HumanAvatar, RobotAvatar } from '@/src/design-system';
import { DurationSlider } from '@/components/trade/DurationSlider';
import { getRandomSymbol } from '@/data/historicalData';

export default function VsAIStart() {
  const router = useRouter();
  const { theme } = useTheme();
  const [duration, setDuration] = useState(15);
  const [randomSymbol, setRandomSymbol] = useState(getRandomSymbol());

  // Randomize symbol on mount
  useEffect(() => {
    setRandomSymbol(getRandomSymbol());
  }, []);

  const handleRerollSymbol = () => {
    setRandomSymbol(getRandomSymbol());
  };

  const handleStartMatch = () => {
    router.push({
      pathname: '/vs-ai-play',
      params: {
        symbol: randomSymbol.symbol,
        duration: duration.toString()
      }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'User vs AI',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={styles.header} elevation="med">
        <Ionicons name="trophy" size={48} color={theme.warning} />
        <Text variant="h2" weight="bold" center>The Battle Begins</Text>
        <Text variant="body" muted center>
          Compete against our AI trading agent
        </Text>
      </Card>

      {/* Arena - User vs AI */}
      <Card style={styles.arena}>
        <View style={styles.combatant}>
          <HumanAvatar size={100} />
          <Card padding="sm" style={styles.combatantInfo}>
            <Text variant="h3" weight="semibold" center>You</Text>
            <Text variant="xs" muted center>Starting Capital</Text>
            <Text variant="body" weight="bold" center color={theme.success}>
              $100,000
            </Text>
          </Card>
        </View>

        <View style={[styles.vsContainer, { backgroundColor: theme.danger + '20' }]}>
          <Text variant="h1" weight="bold" color={theme.danger}>VS</Text>
        </View>

        <View style={styles.combatant}>
          <RobotAvatar size={100} />
          <Card padding="sm" style={styles.combatantInfo}>
            <Text variant="h3" weight="semibold" center>AI Agent</Text>
            <Text variant="xs" muted center>Starting Capital</Text>
            <Text variant="body" weight="bold" center color={theme.primary}>
              $100,000
            </Text>
          </Card>
        </View>
      </Card>

      {/* Random Symbol Display */}
      <Card style={StyleSheet.flatten([styles.symbolCard, { backgroundColor: theme.primary + '10' }])}>
        <View style={styles.symbolHeader}>
          <View>
            <Text variant="small" muted>Trading Symbol (Random)</Text>
            <Text variant="h2" weight="bold" color={theme.primary}>
              {randomSymbol.symbol}
            </Text>
            <Text variant="body" muted>{randomSymbol.name}</Text>
          </View>
          <Button
            variant="secondary"
            size="small"
            onPress={handleRerollSymbol}
            icon={<Ionicons name="shuffle" size={16} color={theme.text} />}
          >
            Reroll
          </Button>
        </View>
        <View style={styles.symbolPrice}>
          <Text variant="small" muted>Base Price</Text>
          <Text variant="h3" weight="bold">${randomSymbol.basePrice.toLocaleString()}</Text>
        </View>
      </Card>

      {/* Duration Selection */}
      <Card style={styles.durationCard}>
        <DurationSlider
          value={duration}
          onChange={setDuration}
          min={5}
          max={30}
          label="Match Duration"
        />
        <View style={[styles.infoBox, { backgroundColor: theme.cardHover }]}>
          <Ionicons name="information-circle" size={20} color={theme.accent} />
          <Text variant="xs" muted style={{ flex: 1 }}>
            Shorter durations will have faster playback speed. Both you and the AI will trade on the same historical data.
          </Text>
        </View>
      </Card>

      {/* Match Rules */}
      <Card style={styles.rulesCard}>
        <View style={styles.ruleHeader}>
          <Ionicons name="list" size={24} color={theme.primary} />
          <Text variant="body" weight="semibold">Match Rules</Text>
        </View>
        <View style={styles.rulesList}>
          <View style={styles.ruleItem}>
            <Badge variant="primary" size="small">1</Badge>
            <Text variant="small" muted style={{ flex: 1 }}>
              Both traders start with $100,000
            </Text>
          </View>
          <View style={styles.ruleItem}>
            <Badge variant="primary" size="small">2</Badge>
            <Text variant="small" muted style={{ flex: 1 }}>
              Winner determined by highest final P&L
            </Text>
          </View>
          <View style={styles.ruleItem}>
            <Badge variant="primary" size="small">3</Badge>
            <Text variant="small" muted style={{ flex: 1 }}>
              You can pause/rewind, AI trades automatically
            </Text>
          </View>
          <View style={styles.ruleItem}>
            <Badge variant="primary" size="small">4</Badge>
            <Text variant="small" muted style={{ flex: 1 }}>
              Use playback controls to analyze market movements
            </Text>
          </View>
        </View>
      </Card>

        {/* Start Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          onPress={handleStartMatch}
          icon={<Ionicons name="play-circle" size={24} color={theme.bg} />}
        >
          Start Match
        </Button>

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
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
  header: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.lg,
  },
  arena: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.lg,
  },
  combatant: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  combatantInfo: {
    minWidth: 120,
    gap: tokens.spacing.xs,
  },
  vsContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.full,
  },
  symbolCard: {
    gap: tokens.spacing.md,
  },
  symbolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  symbolPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000010',
  },
  durationCard: {
    gap: tokens.spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    alignItems: 'flex-start',
  },
  rulesCard: {
    gap: tokens.spacing.md,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  rulesList: {
    gap: tokens.spacing.sm,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
});
