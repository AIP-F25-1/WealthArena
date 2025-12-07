// CandlestickChart Component - Real-time candlestick charts with theme support
import React from 'react';
import Svg, { Line, Text as SvgText, Path, Circle } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlestickChartProps {
  data: CandleData[];
  width?: number;
  height?: number;
  showVolume?: boolean;
}

export const CandlestickChart = ({ 
  data, 
  width = 350, 
  height = 250,
  showVolume = false,
}: CandlestickChartProps) => {
  const { theme } = useTheme();

  if (!data || data.length === 0) return null;

  const chartHeight = showVolume ? height * 0.7 : height;
  const padding = { top: 10, bottom: 20, left: 10, right: 40 };

  // Calculate price range
  const allPrices = data.flatMap(d => [d.high, d.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  // Calculate candle width - MAXIMIZE screen space usage
  const candleWidth = (width - padding.left - padding.right) / data.length;

  // Convert price to Y coordinate
  const priceToY = (price: number) => {
    return padding.top + ((maxPrice - price) / priceRange) * (chartHeight - padding.top - padding.bottom);
  };

  // Generate price labels
  const priceLevels = 5;
  const priceStep = priceRange / (priceLevels - 1);
  const priceLabels = Array.from({ length: priceLevels }, (_, i) => {
    const price = maxPrice - (priceStep * i);
    return {
      price,
      y: priceToY(price),
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Clean grid lines */}
        {priceLabels.map((label, index) => (
          <React.Fragment key={`grid-${label.price}-${index}`}>
            <Line
              x1={padding.left}
              y1={label.y}
              x2={width - padding.right}
              y2={label.y}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={1}
            />
            <SvgText
              x={width - padding.right + 8}
              y={label.y + 5}
              fontSize="10"
              fill="rgba(255, 255, 255, 0.9)"
              fontFamily="System"
            >
              {label.price.toFixed(1)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Line Chart - using theme colors */}
        <Path
          d={(() => {
            if (data.length === 0) return '';
            let path = '';
            data.forEach((candle, index) => {
              const x = padding.left + (index * candleWidth) + (candleWidth / 2);
              const y = priceToY(candle.close);
              
              if (index === 0) {
                path += `M ${x} ${y}`;
              } else {
                path += ` L ${x} ${y}`;
              }
            });
            return path;
          })()}
          stroke={theme.primary}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data Points */}
        {data.map((candle, index) => {
          const x = padding.left + (index * candleWidth) + (candleWidth / 2);
          const y = priceToY(candle.close);
          
          return (
            <Circle
              key={`point-${candle.timestamp}-${index}`}
              cx={x}
              cy={y}
              r="2"
              fill={theme.primary}
              stroke="none"
            />
          );
        })}

        {/* Bottom axis line */}
        <Line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={width - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={1}
        />
      </Svg>

      {/* Time labels */}
      <View style={styles.timeLabels}>
        <Text variant="xs" muted style={styles.timeLabel}>{data[0]?.timestamp || ''}</Text>
        <Text variant="xs" muted style={styles.timeLabel}>{data[Math.floor(data.length / 2)]?.timestamp || ''}</Text>
        <Text variant="xs" muted style={styles.timeLabel}>{data[data.length - 1]?.timestamp || ''}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  timeLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontFamily: 'System',
  },
});

