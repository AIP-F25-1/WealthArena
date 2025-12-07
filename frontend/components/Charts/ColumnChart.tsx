import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, G } from 'react-native-svg';
import { useTheme } from '@/src/design-system';

interface ColumnChartProps {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      color?: (opacity: number) => string;
      strokeWidth?: number;
    }[];
  };
  title?: string;
  height?: number;
}

const screenWidth = Dimensions.get('window').width;

export default function ColumnChart({ data, title, height = 220 }: ColumnChartProps) {
  const { theme } = useTheme();
  
  const chartWidth = screenWidth - 32;
  const chartHeight = height;
  const padding = 20;
  const availableWidth = chartWidth - (padding * 2);
  const availableHeight = chartHeight - (padding * 2);
  
  const chartData = data.datasets[0]?.data || [];
  const labels = data.labels || [];
  const maxValue = Math.max(...chartData, 1);
  
  const barWidth = (availableWidth / chartData.length) * 0.6;
  const barSpacing = (availableWidth / chartData.length) * 0.4;
  
  // Generate grid lines
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const value = (maxValue * i) / 4;
    const y = padding + ((4 - i) / 4) * availableHeight;
    gridLines.push({ y, value });
  }

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        {gridLines.map((line, index) => (
          <Line
            key={`grid-${index}`}
            x1={padding}
            y1={line.y}
            x2={chartWidth - padding}
            y2={line.y}
            stroke={theme.border}
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Y-axis labels */}
        {gridLines.map((line, index) => (
          <SvgText
            key={`label-${index}`}
            x={padding - 5}
            y={line.y + 4}
            fontSize="10"
            fill={theme.muted}
            textAnchor="end"
          >
            {line.value.toFixed(1)}
          </SvgText>
        ))}
        
        {/* Bars */}
        {chartData.map((value, index) => {
          const barHeight = (value / maxValue) * availableHeight;
          const x = padding + (index * (barWidth + barSpacing)) + (barSpacing / 2);
          const y = padding + availableHeight - barHeight;
          
          return (
            <G key={index}>
              {/* Bar */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={theme.primary}
                rx="2"
              />
              
              {/* Value label on top */}
              <SvgText
                x={x + barWidth / 2}
                y={y - 5}
                fontSize="10"
                fill={theme.text}
                textAnchor="middle"
                fontWeight="bold"
              >
                {value.toFixed(1)}
              </SvgText>
              
              {/* X-axis label */}
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - padding + 15}
                fontSize="10"
                fill={theme.muted}
                textAnchor="middle"
              >
                {labels[index]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
