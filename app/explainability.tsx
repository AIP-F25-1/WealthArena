import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';

interface RationaleItem {
  id: string;
  title: string;
  description: string;
  details: string[];
  expanded: boolean;
}

export default function ExplainabilityScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [rationales, setRationales] = useState<RationaleItem[]>([
    {
      id: '1',
      title: 'Buy AAPL - Strong Earnings Report',
      description: "AI identified a significant positive sentiment shift following Apple's Q3 earnings beat.",
      details: [
        'EPS: $1.52 (vs. $1.43 estimate)',
        'Revenue: $89.5B (vs. $88.7B estimate)',
        'Guidance: Raised Q4 outlook',
        'Sentiment Score: +0.85 (from 0.20)',
      ],
      expanded: false,
    },
    {
      id: '2',
      title: 'Technical Indicators Alignment',
      description: 'Multiple technical indicators show bullish signals.',
      details: [
        'RSI: 62 (Bullish momentum)',
        'MACD: Positive crossover',
        'Moving Averages: Golden cross pattern',
        'Volume: +45% above average',
      ],
      expanded: false,
    },
  ]);

  const toggleExpand = (id: string) => {
    setRationales(rationales.map(r => 
      r.id === id ? { ...r, expanded: !r.expanded } : r
    ));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'AI Explainability',
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
        <Card style={styles.headerCard} elevation="med">
          <Icon name="lab" size={36} color={theme.accent} />
          <Text variant="h2" weight="bold" center>AI Explainability</Text>
          <Text variant="small" muted center>
            Understand how our AI makes trading decisions
          </Text>
        </Card>

        {/* Signal Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Badge variant="success" size="medium">BUY Signal</Badge>
            <Text variant="small" muted>Confidence: 87%</Text>
          </View>
          <Text variant="body" weight="semibold">AAPL - Apple Inc.</Text>
          <Text variant="small" muted style={styles.summaryText}>
            Based on technical analysis, news sentiment, and market conditions
          </Text>
        </Card>

        {/* Influence Heatmap */}
        <Card style={styles.heatmapCard}>
          <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
            Decision Influence Map
          </Text>
          <Text variant="small" muted style={styles.heatmapDescription}>
            Visual representation of factors influencing the trading decision
          </Text>
          
          <View style={styles.heatmapContainer}>
            {[
              { factor: 'Earnings Beat', influence: 85, color: theme.success },
              { factor: 'Technical Signals', influence: 72, color: theme.primary },
              { factor: 'Market Sentiment', influence: 68, color: theme.warning },
              { factor: 'Volume Spike', influence: 55, color: theme.accent },
              { factor: 'News Sentiment', influence: 48, color: theme.muted },
              { factor: 'Sector Performance', influence: 35, color: theme.danger },
            ].map((item, index) => (
              <View key={index} style={styles.heatmapRow}>
                <Text variant="small" weight="semibold" style={styles.factorName}>
                  {item.factor}
                </Text>
                <View style={styles.influenceBar}>
                  <View 
                    style={[
                      styles.influenceFill, 
                      { 
                        width: `${item.influence}%`,
                        backgroundColor: item.color 
                      }
                    ]} 
                  />
                </View>
                <Text variant="small" weight="bold" style={styles.influenceValue}>
                  {item.influence}%
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Rationale Cards */}
        <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
          Decision Factors
        </Text>

        {rationales.map((rationale) => (
          <Pressable 
            key={rationale.id}
            onPress={() => toggleExpand(rationale.id)}
          >
            <Card style={styles.rationaleCard}>
              <View style={styles.rationaleHeader}>
                <View style={styles.rationaleLeft}>
                  <Icon name="lab" size={24} color={theme.primary} />
                  <Text variant="body" weight="semibold" style={styles.rationaleTitle}>
                    {rationale.title}
                  </Text>
                </View>
                <Icon 
                  name={rationale.expanded ? 'alert' : 'alert'} 
                  size={20} 
                  color={theme.muted} 
                />
              </View>

              <Text variant="small" muted>
                {rationale.description}
              </Text>

              {rationale.expanded && (
                <View style={styles.detailsList}>
                  {rationale.details.map((detail, index) => (
                    <View key={index} style={styles.detailItem}>
                      <Icon name="check-shield" size={16} color={theme.primary} />
                      <Text variant="small" style={styles.detailText}>{detail}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </Pressable>
        ))}

        {/* Action Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          icon={<Icon name="execute" size={20} color={theme.bg} />}
          onPress={() => router.push('/trade-setup')}
        >
          Execute Trade
        </Button>

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
    gap: tokens.spacing.sm,
  },
  summaryCard: {
    gap: tokens.spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: tokens.spacing.xs,
  },
  rationaleCard: {
    gap: tokens.spacing.sm,
  },
  rationaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rationaleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  rationaleTitle: {
    flex: 1,
  },
  detailsList: {
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000005',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  detailText: {
    flex: 1,
    lineHeight: 18,
  },
  heatmapCard: {
    gap: tokens.spacing.sm,
  },
  heatmapDescription: {
    marginBottom: tokens.spacing.sm,
  },
  heatmapContainer: {
    gap: tokens.spacing.sm,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  factorName: {
    minWidth: 120,
  },
  influenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  influenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  influenceValue: {
    minWidth: 40,
    textAlign: 'right',
  },
});
