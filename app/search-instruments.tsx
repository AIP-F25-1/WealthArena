import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, TextInput, Icon, Badge, Sparkline, FAB, tokens } from '@/src/design-system';

const POPULAR_INSTRUMENTS = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'Stock', change: +2.3 },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'Stock', change: -1.2 },
  { symbol: 'MSFT', name: 'Microsoft', type: 'Stock', change: +1.5 },
  { symbol: 'BTC', name: 'Bitcoin', type: 'Crypto', change: +5.7 },
  { symbol: 'ETH', name: 'Ethereum', type: 'Crypto', change: +3.2 },
  { symbol: 'EUR/USD', name: 'Euro/Dollar', type: 'Forex', change: +0.2 },
];

export default function SearchInstrumentsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInstruments = POPULAR_INSTRUMENTS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Search',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Header */}
        <Card style={styles.searchCard}>
          <Icon name="market" size={28} color={theme.primary} />
          <Text variant="h3" weight="bold">Search Instruments</Text>
        </Card>

        {/* Search Input */}
        <TextInput
          placeholder="Search stocks, crypto, forex..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          rightIcon={<Icon name="market" size={20} color={theme.muted} />}
        />

        {/* Results */}
        <Text variant="body" weight="semibold" style={styles.resultsTitle}>
          {searchQuery ? `Results (${filteredInstruments.length})` : 'Popular Instruments'}
        </Text>

        {filteredInstruments.map((item) => (
          <Pressable 
            key={item.symbol}
            onPress={() => router.push(`/trade-detail?symbol=${item.symbol}`)}
          >
            <Card style={styles.instrumentCard}>
              <View style={styles.instrumentHeader}>
                <View style={styles.instrumentLeft}>
                  <View style={[styles.symbolCircle, { backgroundColor: theme.primary + '20' }]}>
                    <Text variant="body" weight="bold">
                      {item.symbol.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.instrumentInfo}>
                    <Text variant="body" weight="semibold">{item.symbol}</Text>
                    <Text variant="small" muted>{item.name}</Text>
                  </View>
                </View>
                <Badge variant={item.type === 'Stock' ? 'primary' : item.type === 'Crypto' ? 'warning' : 'secondary'} size="small">
                  {item.type}
                </Badge>
              </View>

              <View style={styles.instrumentFooter}>
                <Sparkline 
                  data={[100, 105, 103, 108, 106, 112, 110]}
                  width={100}
                  height={30}
                  color={item.change > 0 ? theme.primary : theme.danger}
                />
                <Text 
                  variant="body" 
                  weight="bold"
                  color={item.change > 0 ? theme.primary : theme.danger}
                >
                  {item.change > 0 ? '+' : ''}{item.change}%
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}

        {filteredInstruments.length === 0 && (
          <Card style={styles.emptyCard}>
            <Icon name="market" size={48} color={theme.muted} />
            <Text variant="h3" weight="semibold" center>No Results</Text>
            <Text variant="small" muted center>
              Try searching with a different keyword
            </Text>
          </Card>
        )}

        {/* Bottom Spacing */}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  resultsTitle: {
    marginTop: tokens.spacing.xs,
  },
  instrumentCard: {
    gap: tokens.spacing.sm,
  },
  instrumentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  instrumentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  symbolCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrumentInfo: {
    gap: 2,
  },
  instrumentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xl,
  },
});
