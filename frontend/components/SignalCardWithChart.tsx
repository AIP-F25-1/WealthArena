/**
 * Signal Card with Live Chart Data
 * Fetches and displays live market data for trading signals
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text, Card, Button, Badge, Icon, tokens } from '@/src/design-system';
import CandlestickChart from './CandlestickChart';
import { marketDataService } from '@/services/marketDataService';

interface SignalCardWithChartProps {
  signal: any;
  onExplain?: () => void;
  onCreatePortfolio?: () => void;
  getSignalColor: (signal: string) => string;
  getSignalVariant: (signal: string) => 'success' | 'danger' | 'secondary';
  theme: any;
  router: any;
}

export const SignalCardWithChart: React.FC<SignalCardWithChartProps> = ({
  signal,
  onExplain,
  onCreatePortfolio,
  getSignalColor,
  getSignalVariant,
  theme,
  router,
}) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        setIsLoadingChart(true);
        const symbol = signal.Symbol || signal.symbol;
        if (!symbol) {
          setIsLoadingChart(false);
          return;
        }

        // Fetch live market data
        const data = await marketDataService.getStockData(symbol);
        
        if (data && data.data && data.data.length > 0) {
          // Check if we have real data (not mock)
          const isRealData = await marketDataService.checkDataAvailability(symbol);
          setHasRealData(isRealData);
          
          // Convert to chart format
          const chartDataFormatted = data.data.map((candle: any) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          }));
          
          setChartData(chartDataFormatted);
        }
      } catch (error) {
        console.error('Failed to load chart data:', error);
        setChartData([]);
        setHasRealData(false);
      } finally {
        setIsLoadingChart(false);
      }
    };

    loadChartData();
  }, [signal.Symbol, signal.symbol]);

  const signalSymbol = signal.Symbol || signal.symbol;
  const signalType = signal.Signal || signal.signal;
  const assetType = signal.AssetType || signal.assetType || 'Stock';
  const entryPrice = signal.EntryPrice || signal.entryPrice || signal.price;
  const targetPrice = signal.TakeProfit1 || signal.target;
  const expectedReturn = signal.ExpectedReturn || signal.expectedReturn;
  const confidence = signal.Confidence || signal.ConfidenceScore || (signal.confidence ? signal.confidence / 100 : 0);

  return (
    <Card style={styles.signalCard}>
      <View style={styles.signalHeader}>
        <View style={styles.signalLeft}>
          <Text variant="body" weight="bold">{signalSymbol}</Text>
          <Text variant="xs" muted>{assetType}</Text>
        </View>
        <Badge variant={getSignalVariant(signalType)} size="medium">
          {signalType}
        </Badge>
      </View>

      <View style={styles.signalMetrics}>
        <View style={styles.metric}>
          <Text variant="xs" muted>Entry Price</Text>
          <Text variant="small" weight="semibold">
            ${entryPrice?.toFixed(2) || 'N/A'}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Target</Text>
          <Text variant="small" weight="semibold">
            ${targetPrice?.toFixed(2) || 'N/A'}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="xs" muted>Expected Return</Text>
          <Text variant="small" weight="semibold" color={theme.primary}>
            {expectedReturn?.toFixed(2) || 'N/A'}%
          </Text>
        </View>
      </View>

      {/* Live Chart Data */}
      {isLoadingChart ? (
        <View style={styles.chartLoading}>
          <Text variant="xs" muted>Loading chart data...</Text>
        </View>
      ) : chartData.length > 0 ? (
        <>
          <CandlestickChart 
            data={chartData} 
            chartType="daily"
          />
          {!hasRealData && (
            <Text variant="xs" muted center style={{ marginTop: tokens.spacing.xs }}>
              Using historical data - live data unavailable
            </Text>
          )}
        </>
      ) : (
        <View style={styles.chartLoading}>
          <Text variant="xs" muted>Chart data unavailable</Text>
        </View>
      )}

      <View style={styles.confidenceContainer}>
        <View style={styles.confidenceLabel}>
          <Text variant="xs" muted>Confidence</Text>
          <Text variant="xs" weight="semibold">{(confidence * 100).toFixed(0)}%</Text>
        </View>
        <View style={[styles.confidenceBar, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.confidenceFill, 
              { 
                backgroundColor: getSignalColor(signalType),
                width: `${(confidence * 100)}%` 
              }
            ]} 
          />
        </View>
      </View>

      {/* Actions */}
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
          onPress={onCreatePortfolio || (() => router.push('/trade-setup'))}
          icon={<Icon name="briefcase" size={16} color={theme.bg} />}
        >
          {onCreatePortfolio ? 'Create Portfolio' : 'Trade'}
        </Button>
      </View>
    </Card>
  );
};

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
  signalMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#00000005',
  },
  metric: {
    gap: 2,
    alignItems: 'center',
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
    height: 6,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  signalActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  chartLoading: {
    padding: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
});

