import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import CandlestickChart from '../components/CandlestickChart';
import { mockDailyData, mockWeeklyData, mockMonthlyData, mockYearlyData, sampleCandleData } from '../data/mockCandleData';

const CandlestickDemo = () => {
  const [selectedType, setSelectedType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  
  const getDataForType = (type: string) => {
    switch (type) {
      case 'daily': return mockDailyData;
      case 'weekly': return mockWeeklyData;
      case 'monthly': return mockMonthlyData;
      case 'yearly': return mockYearlyData;
      default: return sampleCandleData;
    }
  };

  const chartTypes = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ] as const;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Candlestick Chart Demo</Text>
        <Text style={styles.subtitle}>Interactive trading chart with touch tooltips</Text>
      </View>

      {/* Chart Type Selector */}
      <View style={styles.selectorContainer}>
        {chartTypes.map((type) => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.selectorButton,
              selectedType === type.key && styles.selectorButtonActive
            ]}
            onPress={() => setSelectedType(type.key)}
          >
            <Text style={[
              styles.selectorButtonText,
              selectedType === type.key && styles.selectorButtonTextActive
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart Container */}
      <View style={styles.chartContainer}>
        <CandlestickChart
          data={getDataForType(selectedType)}
          chartType={selectedType}
        />
      </View>

      {/* Chart Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Chart Features:</Text>
        <Text style={styles.infoText}>• Responsive design adapts to screen width</Text>
        <Text style={styles.infoText}>• Touch any candle to see OHLC data</Text>
        <Text style={styles.infoText}>• Smooth animations on load</Text>
        <Text style={styles.infoText}>• Bullish candles: Green (#00FF6A)</Text>
        <Text style={styles.infoText}>• Bearish candles: Red (#FF3B30)</Text>
        <Text style={styles.infoText}>• Auto-scaling based on chart type</Text>
      </View>

      {/* Data Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Current Data:</Text>
        <Text style={styles.statsText}>
          {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} View: {getDataForType(selectedType).length} candles
        </Text>
        <Text style={styles.statsText}>
          Price Range: ${Math.min(...getDataForType(selectedType).map(d => d.low)).toFixed(2)} - ${Math.max(...getDataForType(selectedType).map(d => d.high)).toFixed(2)}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
  },
  selectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  selectorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectorButtonActive: {
    backgroundColor: '#00FF6A',
    borderColor: '#00FF6A',
  },
  selectorButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  selectorButtonTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  chartContainer: {
    marginHorizontal: 10,
    marginBottom: 20,
  },
  infoContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 6,
  },
  statsContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: 'rgba(0,255,106,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,106,0.2)',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00FF6A',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
});

export default CandlestickDemo;
