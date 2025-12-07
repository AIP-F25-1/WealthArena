/**
 * Simple Candlestick Chart Component
 * Lightweight chart visualization for React Native
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, tokens, useTheme } from '@/src/design-system';
import { CandleData } from '@/utils/simulationEngine';

interface SimpleCandlestickChartProps {
  readonly candles: CandleData[];
  readonly height?: number;
  readonly showVolume?: boolean;
}

export function SimpleCandlestickChart({
  candles,
  height = 300,
  showVolume = false
}: Readonly<SimpleCandlestickChartProps>) {
  const { theme } = useTheme();

  if (candles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text variant="body" muted>No data available</Text>
      </View>
    );
  }

  // Calculate price range
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const maxPrice = Math.max(...allPrices);
  const minPrice = Math.min(...allPrices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1;

  const candleWidth = 8;
  const candleSpacing = 4;
  const chartHeight = showVolume ? height * 0.7 : height;

  const priceToY = (price: number) => {
    return ((maxPrice + padding - price) / (priceRange + 2 * padding)) * chartHeight;
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Price Labels */}
      <View style={styles.priceLabels}>
        <Text variant="xs" muted>${maxPrice.toFixed(2)}</Text>
        <Text variant="xs" muted>${((maxPrice + minPrice) / 2).toFixed(2)}</Text>
        <Text variant="xs" muted>${minPrice.toFixed(2)}</Text>
      </View>

      {/* Chart */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.chartContainer, { height: chartHeight }]}>
          {/* Line Chart */}
          <View style={styles.lineChartContainer}>
            {candles.map((candle, index) => {
              const closeY = priceToY(candle.close);
              const x = index * (candleWidth + candleSpacing) + candleWidth / 2;

              return (
                <View key={candle.timestamp}>
                  {/* Data Point */}
                  <View
                    style={[
                      styles.dataPoint,
                      {
                        backgroundColor: theme.primary,
                        left: x - 2,
                        top: closeY - 2,
                      }
                    ]}
                  />
                  {/* Line to next point */}
                  {index < candles.length - 1 && (
                    <View
                      style={[
                        styles.lineSegment,
                        {
                          backgroundColor: theme.primary,
                          left: x,
                          top: closeY,
                          width: candleWidth + candleSpacing,
                          height: 2,
                        }
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Volume bars */}
        {showVolume && (
          <View style={[styles.volumeContainer, { height: height * 0.3 }]}>
            {candles.map((candle) => {
              const maxVolume = Math.max(...candles.map(c => c.volume));
              const volumeHeight = (candle.volume / maxVolume) * (height * 0.25);
              const isGreen = candle.close >= candle.open;

              return (
                <View
                  key={`volume-${candle.timestamp}`}
                  style={[
                    styles.volumeBar,
                    {
                      width: candleWidth,
                      height: volumeHeight,
                      backgroundColor: isGreen ? theme.success + '40' : theme.danger + '40',
                      marginRight: candleSpacing,
                    }
                  ]}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Current Price Indicator */}
      {candles.length > 0 && (
        <View
          style={[
            styles.priceIndicator,
            {
              top: priceToY(candles[candles.length - 1].close),
              backgroundColor: candles[candles.length - 1].close >= candles[candles.length - 1].open
                ? theme.success
                : theme.danger
            }
          ]}
        >
          <Text variant="xs" weight="bold" color={theme.bg}>
            ${candles[candles.length - 1].close.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#00000005',
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000005',
    borderRadius: tokens.radius.md,
  },
  priceLabels: {
    position: 'absolute',
    left: tokens.spacing.xs,
    top: tokens.spacing.sm,
    bottom: tokens.spacing.sm,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingLeft: 60,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  lineChartContainer: {
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  dataPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  lineSegment: {
    position: 'absolute',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: tokens.spacing.xs,
  },
  volumeBar: {
    borderRadius: 2,
  },
  priceIndicator: {
    position: 'absolute',
    right: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
  },
});

