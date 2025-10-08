import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/src/design-system';

interface PieChartProps {
  data: {
    name: string;
    population: number;
    color: string;
    legendFontColor?: string;
    legendFontSize?: number;
  }[];
  title?: string;
  height?: number;
}

const screenWidth = Dimensions.get('window').width;

export default function PieChart({ data, title, height = 220 }: PieChartProps) {
  const { theme } = useTheme();

  const chartWidth = screenWidth - 32;
  const chartHeight = height;
  const centerX = chartWidth / 2;
  const centerY = chartHeight / 2;
  const radius = Math.min(centerX, centerY) - 40;
  
  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.population, 0);
  
  // Generate pie slices
  let currentAngle = 0;
  const slices = data.map((item, index) => {
    const percentage = item.population / total;
    const angle = percentage * 360;
    
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    currentAngle += angle;
    
    return {
      path: pathData,
      color: item.color,
      percentage: percentage * 100,
      name: item.name,
      index
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Pie slices */}
        {slices.map((slice, index) => (
          <Path
            key={index}
            d={slice.path}
            fill={slice.color}
            stroke={theme.surface}
            strokeWidth="2"
          />
        ))}
        
        {/* Center circle */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius * 0.3}
          fill={theme.surface}
          stroke={theme.border}
          strokeWidth="1"
        />
        
        {/* Center text */}
        <SvgText
          x={centerX}
          y={centerY - 5}
          fontSize="12"
          fill={theme.text}
          textAnchor="middle"
          fontWeight="bold"
        >
          Portfolio
        </SvgText>
        <SvgText
          x={centerX}
          y={centerY + 10}
          fontSize="10"
          fill={theme.muted}
          textAnchor="middle"
        >
          Allocation
        </SvgText>
      </Svg>
      
      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: theme.text }]}>
              {item.name}: {item.population}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  legend: {
    marginTop: 16,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
});
