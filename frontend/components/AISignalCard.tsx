import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';
import { Ionicons } from '@expo/vector-icons';
import { AITradingSignal } from '../types/ai-signal';

interface AISignalCardProps {
  signal: AITradingSignal;
  onExplain?: () => void;
  onTrade?: () => void;
}

export default function AISignalCard({ signal, onExplain, onTrade }: AISignalCardProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const getSignalColor = (sig: string) => {
    if (sig === 'BUY') return theme.primary;
    if (sig === 'SELL') return theme.danger;
    return theme.muted;
  };

  const getSignalVariant = (sig: string): 'success' | 'danger' | 'secondary' => {
    if (sig === 'BUY') return 'success';
    if (sig === 'SELL') return 'danger';
    return 'secondary';
  };

  const getIndicatorColor = (status: string) => {
    if (status.includes('bullish') || status.includes('above')) return theme.primary;
    if (status.includes('bearish') || status.includes('below')) return theme.danger;
    return theme.muted;
  };

  return (
    <Card style={styles.signalCard}>
      {/* Header */}
      <View style={styles.signalHeader}>
        <View style={styles.signalLeft}>
          <Text variant="h3" weight="bold">{signal.symbol}</Text>
          <Text variant="xs" muted>{signal.asset_type.toUpperCase()}</Text>
        </View>
        <View style={styles.signalRight}>
          <Badge variant={getSignalVariant(signal.trading_signal.signal)} size="medium">
            {signal.trading_signal.signal}
          </Badge>
          <Text variant="xs" muted>v{signal.trading_signal.model_version}</Text>
        </View>
      </View>

      {/* Price & Entry */}
      <View style={styles.priceSection}>
        <View style={styles.priceItem}>
          <Text variant="xs" muted>Entry Price</Text>
          <Text variant="h3" weight="bold" color={theme.primary}>
            ${signal.entry_strategy.price.toFixed(2)}
          </Text>
          <Text variant="xs" muted>
            Range: ${signal.entry_strategy.price_range[0].toFixed(2)} - ${signal.entry_strategy.price_range[1].toFixed(2)}
          </Text>
        </View>
        <View style={styles.priceItem}>
          <Text variant="xs" muted>Stop Loss</Text>
          <Text variant="body" weight="bold" color={theme.danger}>
            ${signal.stop_loss.price.toFixed(2)}
          </Text>
          <Text variant="xs" color={theme.danger}>
            {signal.stop_loss.percent_loss.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Take Profit Levels */}
      <View style={styles.tpSection}>
        <Text variant="small" weight="semibold">Take Profit Levels</Text>
        {signal.take_profit_levels.map((tp) => (
          <View key={tp.level} style={styles.tpRow}>
            <View style={styles.tpLeft}>
              <Text variant="xs" muted>TP{tp.level}</Text>
              <Text variant="small" weight="semibold" color={theme.primary}>
                ${tp.price.toFixed(2)}
              </Text>
            </View>
            <View style={styles.tpCenter}>
              <Text variant="xs" color={theme.primary}>+{tp.percent_gain.toFixed(2)}%</Text>
              <Text variant="xs" muted>{tp.close_percent}% close</Text>
            </View>
            <View style={styles.tpRight}>
              <View style={[styles.probBar, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.probFill, 
                    { 
                      backgroundColor: theme.primary,
                      width: `${tp.probability * 100}%` 
                    }
                  ]} 
                />
              </View>
              <Text variant="xs" muted>{(tp.probability * 100).toFixed(0)}%</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Confidence Bar */}
      <View style={styles.confidenceContainer}>
        <View style={styles.confidenceLabel}>
          <Text variant="xs" muted>AI Confidence</Text>
          <Text variant="xs" weight="semibold">{(signal.trading_signal.confidence * 100).toFixed(0)}%</Text>
        </View>
        <View style={[styles.confidenceBar, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.confidenceFill, 
              { 
                backgroundColor: getSignalColor(signal.trading_signal.signal),
                width: `${signal.trading_signal.confidence * 100}%` 
              }
            ]} 
          />
        </View>
      </View>

      {/* Risk Management - Always Visible */}
      <View style={styles.riskSection}>
        <View style={styles.riskRow}>
          <View style={styles.riskItem}>
            <Text variant="xs" muted>Risk/Reward</Text>
            <Text variant="small" weight="bold" color={theme.primary}>
              {signal.risk_management.risk_reward_ratio.toFixed(2)}:1
            </Text>
          </View>
          <View style={styles.riskItem}>
            <Text variant="xs" muted>Position Size</Text>
            <Text variant="small" weight="bold">
              {signal.position_sizing.recommended_percent.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.riskItem}>
            <Text variant="xs" muted>Win Probability</Text>
            <Text variant="small" weight="bold">
              {(signal.risk_management.win_probability * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Expandable Details */}
      <Pressable 
        style={styles.expandButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Text variant="xs" color={theme.primary} weight="semibold">
          {expanded ? 'Show Less' : 'Show More Details'}
        </Text>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color={theme.primary} 
        />
      </Pressable>

      {expanded && (
        <>
          {/* Position Sizing Details */}
          <View style={styles.detailSection}>
            <Text variant="small" weight="semibold">Position Sizing ({signal.position_sizing.method})</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text variant="xs" muted>Dollar Amount</Text>
                <Text variant="small" weight="semibold">
                  ${signal.position_sizing.dollar_amount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="xs" muted>Shares</Text>
                <Text variant="small" weight="semibold">
                  {signal.position_sizing.shares}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="xs" muted>Max Loss</Text>
                <Text variant="small" weight="semibold" color={theme.danger}>
                  ${signal.position_sizing.max_loss.toFixed(2)}
                </Text>
              </View>
              {signal.position_sizing.kelly_fraction && (
                <View style={styles.detailItem}>
                  <Text variant="xs" muted>Kelly Fraction</Text>
                  <Text variant="small" weight="semibold">
                    {signal.position_sizing.kelly_fraction.toFixed(3)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Indicators State */}
          <View style={styles.detailSection}>
            <Text variant="small" weight="semibold">Technical Indicators</Text>
            <View style={styles.indicatorGrid}>
              <View style={styles.indicatorItem}>
                <Text variant="xs" muted>RSI</Text>
                <Text variant="small" weight="bold">
                  {signal.indicators_state.rsi.value.toFixed(1)}
                </Text>
                <Badge 
                  variant={signal.indicators_state.rsi.status.includes('bullish') ? 'success' : signal.indicators_state.rsi.status.includes('bearish') ? 'danger' : 'secondary'} 
                  size="small"
                >
                  {signal.indicators_state.rsi.status}
                </Badge>
              </View>
              <View style={styles.indicatorItem}>
                <Text variant="xs" muted>MACD</Text>
                <Text variant="small" weight="bold">
                  {signal.indicators_state.macd.value.toFixed(2)}
                </Text>
                <Badge 
                  variant={signal.indicators_state.macd.status.includes('bullish') ? 'success' : signal.indicators_state.macd.status.includes('bearish') ? 'danger' : 'secondary'} 
                  size="small"
                >
                  {signal.indicators_state.macd.status}
                </Badge>
              </View>
              <View style={styles.indicatorItem}>
                <Text variant="xs" muted>ATR</Text>
                <Text variant="small" weight="bold">
                  {signal.indicators_state.atr.value.toFixed(2)}
                </Text>
                <Badge variant="secondary" size="small">
                  {signal.indicators_state.atr.status.replace('_', ' ')}
                </Badge>
              </View>
              <View style={styles.indicatorItem}>
                <Text variant="xs" muted>Volume</Text>
                <Text variant="small" weight="bold">
                  {signal.indicators_state.volume.value.toFixed(2)}x
                </Text>
                <Badge 
                  variant={signal.indicators_state.volume.status.includes('above') ? 'success' : 'secondary'} 
                  size="small"
                >
                  {signal.indicators_state.volume.status.replace('_', ' ')}
                </Badge>
              </View>
            </View>
          </View>

          {/* Trend Analysis */}
          <View style={styles.trendSection}>
            <Text variant="small" weight="semibold">Trend Analysis</Text>
            <View style={styles.trendRow}>
              <View style={styles.trendItem}>
                <Text variant="xs" muted>Direction</Text>
                <View style={styles.trendBadge}>
                  <Ionicons 
                    name={signal.indicators_state.trend.direction === 'up' ? 'trending-up' : signal.indicators_state.trend.direction === 'down' ? 'trending-down' : 'remove'} 
                    size={16} 
                    color={signal.indicators_state.trend.direction === 'up' ? theme.primary : signal.indicators_state.trend.direction === 'down' ? theme.danger : theme.muted} 
                  />
                  <Text variant="small" weight="semibold">
                    {signal.indicators_state.trend.direction.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.trendItem}>
                <Text variant="xs" muted>Strength</Text>
                <Badge 
                  variant={signal.indicators_state.trend.strength === 'strong' ? 'success' : signal.indicators_state.trend.strength === 'moderate' ? 'warning' : 'secondary'} 
                  size="small"
                >
                  {signal.indicators_state.trend.strength}
                </Badge>
              </View>
            </View>
          </View>

          {/* Model Metadata */}
          <View style={styles.detailSection}>
            <Text variant="small" weight="semibold">Model Information</Text>
            <View style={styles.modelInfo}>
              <Text variant="xs" muted>Type: {signal.model_metadata.model_type}</Text>
              <Text variant="xs" muted>Agents: {signal.model_metadata.agents_used.join(', ')}</Text>
              <Text variant="xs" muted>Backtest Sharpe: {signal.model_metadata.backtest_sharpe.toFixed(2)}</Text>
            </View>
          </View>

          {/* Feature Importance */}
          <View style={styles.detailSection}>
            <Text variant="small" weight="semibold">Key Features</Text>
            {Object.entries(signal.model_metadata.feature_importance)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([feature, importance]) => (
                <View key={feature} style={styles.featureRow}>
                  <Text variant="xs" muted style={styles.featureName}>{feature}</Text>
                  <View style={[styles.featureBar, { backgroundColor: theme.border }]}>
                    <View 
                      style={[
                        styles.featureFill, 
                        { 
                          backgroundColor: theme.accent,
                          width: `${importance * 100}%` 
                        }
                      ]} 
                    />
                  </View>
                  <Text variant="xs" weight="semibold">{(importance * 100).toFixed(0)}%</Text>
                </View>
              ))}
          </View>

          {/* Reasoning */}
          <View style={styles.reasoningSection}>
            <Text variant="small" weight="semibold">Entry Reasoning</Text>
            <Text variant="small" muted>{signal.entry_strategy.reasoning}</Text>
            <Text variant="small" weight="semibold" style={{ marginTop: tokens.spacing.xs }}>
              Stop Loss Reasoning
            </Text>
            <Text variant="small" muted>{signal.stop_loss.reasoning}</Text>
          </View>
        </>
      )}

      {/* Action Buttons */}
      <View style={styles.signalActions}>
        <Button
          variant="secondary"
          size="small"
          onPress={onExplain || (() => router.push('/explainability'))}
          icon={<Icon name="lab" size={16} color={theme.primary} />}
        >
          Explain
        </Button>
        <Button
          variant="primary"
          size="small"
          onPress={onTrade || (() => router.push('/trade-setup'))}
          icon={<Icon name="execute" size={16} color={theme.bg} />}
        >
          Trade
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  signalCard: {
    gap: tokens.spacing.sm,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  signalLeft: {
    gap: 2,
  },
  signalRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: tokens.spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#00000005',
  },
  priceItem: {
    alignItems: 'center',
    gap: 4,
  },
  tpSection: {
    gap: tokens.spacing.xs,
  },
  tpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  tpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  tpCenter: {
    alignItems: 'flex-start',
    flex: 1,
  },
  tpRight: {
    alignItems: 'flex-end',
    gap: 2,
    flex: 1,
  },
  probBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  probFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceContainer: {
    gap: tokens.spacing.xs,
  },
  confidenceLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceBar: {
    height: 8,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  riskSection: {
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderColor: '#00000005',
  },
  riskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskItem: {
    alignItems: 'center',
    gap: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  detailSection: {
    gap: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderColor: '#00000005',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  detailItem: {
    gap: 2,
    minWidth: '45%',
  },
  indicatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  indicatorItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: '22%',
  },
  trendSection: {
    gap: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderColor: '#00000005',
  },
  trendRow: {
    flexDirection: 'row',
    gap: tokens.spacing.lg,
  },
  trendItem: {
    gap: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modelInfo: {
    gap: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  featureName: {
    width: 80,
  },
  featureBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  featureFill: {
    height: '100%',
    borderRadius: 3,
  },
  reasoningSection: {
    gap: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderColor: '#00000005',
  },
  signalActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
});

