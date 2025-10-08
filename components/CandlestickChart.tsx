import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandlestickChartProps {
  data: CandleData[];
  chartType: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

interface TooltipData {
  x: number;
  y: number;
  data: CandleData;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, chartType }) => {
  const { width: screenWidth } = useWindowDimensions();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [animationValue] = useState(new Animated.Value(0));
  
  // Calculate chart dimensions
  const padding = 20;
  const chartWidth = Math.min(screenWidth - (padding * 2), 400);
  const chartHeight = 200;
  // Increased right padding to ensure current candlestick and price are always visible
  const chartPadding = { top: 20, bottom: 30, left: 10, right: 120 };
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  
  // Get candle count based on chart type
  const getCandleCount = (type: string) => {
    switch (type) {
      case 'daily': return 30;
      case 'weekly': return 12;
      case 'monthly': return 12;
      case 'yearly': return 10;
      default: return 30;
    }
  };
  
  const candleCount = getCandleCount(chartType);
  const displayData = data.slice(-candleCount);
  
  // Calculate candle dimensions
  const availableWidth = chartWidth - chartPadding.left - chartPadding.right;
  // Ensure we have enough space for the current candlestick by using one less candle for spacing
  const effectiveCandleCount = Math.max(1, candleCount - 1);
  const candleSpacing = availableWidth / effectiveCandleCount;
  const candleWidth = Math.max(6, candleSpacing * 0.7);
  const candlePadding = (candleSpacing - candleWidth) / 2;
  
  // Find min/max values for scaling with padding for wider window
  const minValue = Math.min(...displayData.map(d => d.low));
  const maxValue = Math.max(...displayData.map(d => d.high));
  const valueRange = maxValue - minValue;
  const paddingPercent = 0.15; // 15% padding on top and bottom
  const paddedMinValue = minValue - (valueRange * paddingPercent);
  const paddedMaxValue = maxValue + (valueRange * paddingPercent);
  
  // Scale functions
  const scaleY = (value: number) => {
    const paddedValueRange = paddedMaxValue - paddedMinValue;
    return chartPadding.top + ((paddedMaxValue - value) / paddedValueRange) * innerHeight;
  };
  
  // Generate grid lines with proper vertical stretching
  const gridLines = useMemo(() => {
    const lines = [];
    const numLines = 5;
    const paddedValueRange = paddedMaxValue - paddedMinValue;
    for (let i = 0; i <= numLines; i++) {
      const value = paddedMinValue + (paddedValueRange * i) / numLines;
      const y = chartPadding.top + (i / numLines) * innerHeight;
      lines.push({ y, value });
    }
    return lines;
  }, [paddedMinValue, paddedMaxValue, innerHeight, chartPadding.top]);
  
  // Render individual candle
  const renderCandle = (candle: CandleData, index: number) => {
    const x = chartPadding.left + (index * candleSpacing) + candlePadding - 5;
    const isBullish = candle.close >= candle.open;
    
    const openY = scaleY(candle.open);
    const closeY = scaleY(candle.close);
    const highY = scaleY(candle.high);
    const lowY = scaleY(candle.low);
    
    const bodyHeight = Math.abs(closeY - openY);
    const bodyTop = Math.min(openY, closeY);
    
    return (
      <G key={`candle-${index}`}>
        {/* Wick */}
        <Line
          x1={x + candleWidth / 2}
          y1={highY}
          x2={x + candleWidth / 2}
          y2={lowY}
          stroke={isBullish ? '#58CC02' : '#DC2626'}
          strokeWidth="1.5"
        />
        {/* Body */}
        <Rect
          x={x}
          y={bodyTop}
          width={candleWidth}
          height={Math.max(bodyHeight, 1)}
          fill={isBullish ? '#58CC02' : '#DC2626'}
          rx="1"
        />
      </G>
    );
  };
  
  // Handle touch events
  const handleTouch = useCallback((event: any, candle: CandleData, index: number) => {
    const { locationX, locationY } = event.nativeEvent;
    setTooltip({
      x: locationX,
      y: locationY,
      data: candle
    });
    
    // Auto-hide tooltip after 3 seconds
    setTimeout(() => {
      setTooltip(null);
    }, 3000);
  }, []);

  // Animation on mount
  React.useEffect(() => {
    Animated.timing(animationValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [animationValue]);
  
  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.chartCard,
          {
            opacity: animationValue,
            transform: [{
              scaleY: animationValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              })
            }]
          }
        ]}
      >
        <Svg 
          width={chartWidth} 
          height={chartHeight} 
          style={styles.chart}
          onPress={(event) => {
            // Handle touch events for tooltip
            const { locationX } = event.nativeEvent;
            const candleIndex = Math.floor((locationX - chartPadding.left) / candleSpacing);
            if (candleIndex >= 0 && candleIndex < displayData.length) {
              handleTouch(event, displayData[candleIndex], candleIndex);
            }
          }}
        >
          {/* Grid lines with proper vertical stretching */}
          {gridLines.map((line, index) => (
            <Line
              key={`grid-${line.y}-${line.value}`}
              x1={chartPadding.left + 5}
              y1={line.y}
              x2={chartWidth - chartPadding.right}
              y2={line.y}
              stroke="rgba(128,128,128,0.3)"
              strokeWidth="1"
            />
          ))}
          
          {/* Y-axis labels */}
          {gridLines.map((line, index) => (
            <SvgText
              key={`label-${line.y}-${line.value}`}
              x={chartWidth - 75}
              y={line.y + 4}
              fontSize="10"
              fill="rgba(128,128,128,0.8)"
              textAnchor="end"
            >
              {line.value.toFixed(2)}
            </SvgText>
          ))}
          
          {/* Candles */}
          {displayData.map((candle, index) => (
            <G key={`candle-group-${candle.time}-${index}`}>
              {renderCandle(candle, index)}
            </G>
          ))}
          
          {/* Current price line and indicator */}
          {displayData.length > 0 && (
            <G>
              {/* Current price line */}
              <Line
                x1={chartPadding.left}
                y1={scaleY(displayData[displayData.length - 1].close)}
                x2={chartWidth - chartPadding.right}
                y2={scaleY(displayData[displayData.length - 1].close)}
                stroke="#1cb0f6"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.8"
              />
              {/* Current price label */}
              <SvgText
                x={chartWidth - 80}
                y={scaleY(displayData[displayData.length - 1].close) + 4}
                fontSize="10"
                fill="#1cb0f6"
                fontWeight="bold"
                textAnchor="end"
              >
                ${displayData[displayData.length - 1].close.toFixed(2)}
              </SvgText>
            </G>
          )}
        </Svg>
        
        {/* Tooltip */}
        {tooltip && (
          <View style={[styles.tooltip, { left: tooltip.x, top: tooltip.y }]}>
            <Text style={styles.tooltipText}>Time: {tooltip.data.time}</Text>
            <Text style={styles.tooltipText}>Open: ${tooltip.data.open.toFixed(2)}</Text>
            <Text style={styles.tooltipText}>High: ${tooltip.data.high.toFixed(2)}</Text>
            <Text style={styles.tooltipText}>Low: ${tooltip.data.low.toFixed(2)}</Text>
            <Text style={styles.tooltipText}>Close: ${tooltip.data.close.toFixed(2)}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 10,
  },
  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 10,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chart: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
    borderRadius: 6,
    zIndex: 1000,
    minWidth: 120,
  },
  tooltipText: {
    color: 'white',
    fontSize: 12,
    marginVertical: 1,
  },
});

export default CandlestickChart;
