import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';

interface DataFeed {
  id: string;
  name: string;
  provider: string;
  status: 'active' | 'inactive' | 'error';
  recordsProcessed: number;
}

const DATA_FEEDS: DataFeed[] = [
  { id: '1', name: 'Market Data Feed', provider: 'NYSE', status: 'active', recordsProcessed: 125430 },
  { id: '2', name: 'News Sentiment', provider: 'Reuters', status: 'active', recordsProcessed: 8920 },
  { id: '3', name: 'Crypto Prices', provider: 'Binance', status: 'error', recordsProcessed: 0 },
];

export default function AdminPortalScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' => {
    if (status === 'active') return 'success';
    if (status === 'inactive') return 'warning';
    return 'danger';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Admin Portal',
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
        <Card style={{ ...styles.headerCard, borderColor: theme.yellow, borderWidth: 2 }} elevation="med">
          <Icon name="shield" size={36} color={theme.yellow} />
          <Text variant="h2" weight="bold">Admin Portal</Text>
          <Text variant="small" muted center>Partner access & system controls</Text>
        </Card>

        {/* System Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Icon name="agent" size={28} color={theme.accent} />
            <Text variant="h3" weight="bold">1,248</Text>
            <Text variant="small" muted center>Active Users</Text>
          </Card>

          <Card style={styles.statCard}>
            <Icon name="execute" size={28} color={theme.primary} />
            <Text variant="h3" weight="bold">3,457</Text>
            <Text variant="small" muted center>Trades Today</Text>
          </Card>

          <Card style={styles.statCard}>
            <Icon name="market" size={28} color={theme.yellow} />
            <Text variant="h3" weight="bold">98.5%</Text>
            <Text variant="small" muted center>Uptime</Text>
          </Card>
        </View>

        {/* Data Feeds */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="news" size={24} color={theme.primary} />
            <Text variant="h3" weight="semibold">Data Feeds</Text>
          </View>

          {DATA_FEEDS.map((feed) => (
            <View key={feed.id} style={styles.feedRow}>
              <View style={styles.feedLeft}>
                <View style={styles.feedInfo}>
                  <Text variant="body" weight="semibold">{feed.name}</Text>
                  <Text variant="xs" muted>{feed.provider}</Text>
                </View>
              </View>
              <View style={styles.feedRight}>
                <Badge variant={getStatusVariant(feed.status)} size="small">
                  {feed.status}
                </Badge>
                {feed.status === 'active' && (
                  <Text variant="xs" muted>
                    {feed.recordsProcessed.toLocaleString()} records
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card>

        {/* Admin Actions */}
        <Card style={styles.actionsCard}>
          <Text variant="h3" weight="semibold">Quick Actions</Text>
          
          <Button
            variant="secondary"
            size="medium"
            fullWidth
            icon={<Icon name="settings" size={18} color={theme.primary} />}
          >
            System Settings
          </Button>

          <Button
            variant="secondary"
            size="medium"
            fullWidth
            icon={<Icon name="news" size={18} color={theme.primary} />}
          >
            View Logs
          </Button>

          <Button
            variant="secondary"
            size="medium"
            fullWidth
            icon={<Icon name="agent" size={18} color={theme.primary} />}
          >
            User Management
          </Button>
        </Card>

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
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
    gap: tokens.spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  sectionCard: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  feedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#00000005',
  },
  feedLeft: {
    flex: 1,
  },
  feedInfo: {
    gap: 2,
  },
  feedRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  actionsCard: {
    gap: tokens.spacing.sm,
  },
});
