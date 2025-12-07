/**
 * User vs AI Battle - Start Screen
 * Setup screen for AI trading competition
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, tokens, HumanAvatar, RobotAvatar } from '@/src/design-system';
import { DurationSlider } from '@/components/trade/DurationSlider';
import { TRADING_SYMBOLS, getRandomSymbol } from '@/data/historicalData';
import { assetService, TradingAsset } from '@/services/assetService';

export default function VsAIStart() {
  const router = useRouter();
  const { theme } = useTheme();
  const [duration, setDuration] = useState(15);
  const [selectedAssets, setSelectedAssets] = useState<TradingAsset[]>([]);
  const [availableAssets, setAvailableAssets] = useState<TradingAsset[]>([]);
  const [assetType, setAssetType] = useState<string>('all');
  const [randomSymbol, setRandomSymbol] = useState(getRandomSymbol());

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, [assetType]);

  const loadAssets = async () => {
    try {
      const assets = await assetService.getAssets(
        assetType === 'all' ? {} : { type: assetType }
      );
      setAvailableAssets(assets);
      if (selectedAssets.length === 0 && assets.length > 0) {
        setSelectedAssets([assets[0]]);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  const handleRerollSymbol = () => {
    setRandomSymbol(getRandomSymbol());
  };

  const toggleAsset = (asset: TradingAsset) => {
    if (selectedAssets.some(a => a.id === asset.id)) {
      if (selectedAssets.length === 1) {
        // Don't allow deselecting the last asset
        return;
      }
      setSelectedAssets(prev => prev.filter(a => a.id !== asset.id));
    } else {
      setSelectedAssets(prev => [...prev, asset]);
    }
  };

  const handleStartMatch = () => {
    router.push({
      pathname: '/vs-ai-play',
      params: {
        symbols: selectedAssets.map(a => a.symbol).join(','),
        duration: duration.toString()
      }
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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>User vs AI</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={styles.headerCard} elevation="med">
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
          max={60}
          label="Match Duration"
        />
        <View style={[styles.infoBox, { backgroundColor: theme.cardHover }]}>
          <Ionicons name="information-circle" size={20} color={theme.accent} />
          <Text variant="xs" muted style={{ flex: 1 }}>
            Shorter durations = faster game. Both you and the AI trade on the same historical data.
          </Text>
        </View>
      </Card>

      {/* Asset Type Filter */}
      <Card style={styles.filterCard}>
        <Text variant="h3" weight="semibold" center>Asset Type</Text>
        <View style={styles.filterButtons}>
          {['all', 'stock', 'etf', 'crypto', 'commodity', 'forex'].map((type) => (
            <Pressable
              key={type}
              onPress={() => setAssetType(type)}
              style={[
                styles.filterButton,
                { borderColor: theme.border },
                assetType === type && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
            >
              <Text variant="small" weight="semibold" color={assetType === type ? theme.bg : theme.text}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Asset Selection */}
      <Card style={styles.symbolSelectionCard}>
        <Text variant="h3" weight="semibold" center>Select Trading Assets</Text>
        <Text variant="small" muted center style={{ marginBottom: tokens.spacing.md }}>
          Choose one or more assets to trade against the AI
        </Text>
        
        <View style={styles.symbolGrid}>
          {availableAssets.map((asset) => {
            const isSelected = selectedAssets.some(a => a.id === asset.id);
            return (
              <Pressable
                key={asset.id}
                onPress={() => toggleAsset(asset)}
                style={[
                  styles.symbolOption,
                  isSelected && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + '10' }
                ]}
              >
                <Text variant="body" weight="semibold" center>
                  {asset.symbol}
                </Text>
                <Text variant="xs" muted center>
                  {asset.name}
                </Text>
                <Badge variant="secondary" size="small" style={{ marginTop: tokens.spacing.xs }}>
                  {asset.type}
                </Badge>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.primary} style={{ marginTop: tokens.spacing.xs }} />
                )}
              </Pressable>
            );
          })}
        </View>
        
        <Text variant="xs" muted center style={{ marginTop: tokens.spacing.sm }}>
          Selected: {selectedAssets.map(a => a.symbol).join(', ')}
        </Text>
      </Card>
      
      {/* Beginner Tip */}
      <Card style={StyleSheet.flatten([styles.tipCard, { backgroundColor: theme.warning + '15' }])}>
        <Ionicons name="bulb" size={24} color={theme.warning} />
        <View style={{ flex: 1 }}>
          <Text variant="body" weight="semibold" color={theme.warning}>
            💡 Beginner Tip
          </Text>
          <Text variant="small" muted>
            The AI will make trades automatically. Your goal is to make better trading decisions and earn more profit than the AI by the end of the match!
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
    gap: tokens.spacing.md,
  },
  headerCard: {
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
  filterCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    justifyContent: 'center',
  },
  filterButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  symbolSelectionCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    justifyContent: 'center',
  },
  symbolOption: {
    alignItems: 'center',
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    minWidth: 80,
  },
  infoBox: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    alignItems: 'flex-start',
  },
  tipCard: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
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
