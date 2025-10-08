import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { useTheme, Text } from '@/src/design-system';

interface WorldMapViewProps {
  data?: {
    region: string;
    value: number;
    color?: string;
  }[];
}

export default function WorldMapView({ data = [] }: WorldMapViewProps) {
  const { theme } = useTheme();

  // Default portfolio regions data
  const defaultData = [
    { region: 'North America', value: 45, color: theme.primary },
    { region: 'Europe', value: 25, color: theme.accent },
    { region: 'Asia Pacific', value: 20, color: theme.yellow },
    { region: 'Other', value: 10, color: theme.muted },
  ];

  const mapData = data.length > 0 ? data : defaultData;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {/* Simplified world map representation */}
        <View style={styles.map}>
          {/* North America */}
          <View style={[styles.region, styles.northAmerica, { backgroundColor: mapData[0]?.color || theme.primary }]}>
            <RNText style={styles.regionLabel}>NA</RNText>
          </View>
          
          {/* Europe */}
          <View style={[styles.region, styles.europe, { backgroundColor: mapData[1]?.color || theme.accent }]}>
            <RNText style={styles.regionLabel}>EU</RNText>
          </View>
          
          {/* Asia */}
          <View style={[styles.region, styles.asia, { backgroundColor: mapData[2]?.color || theme.yellow }]}>
            <RNText style={styles.regionLabel}>AS</RNText>
          </View>
          
          {/* Other regions */}
          <View style={[styles.region, styles.other, { backgroundColor: mapData[3]?.color || theme.muted }]}>
            <RNText style={styles.regionLabel}>OT</RNText>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {mapData.map((item, index) => (
          <View key={item.region} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: item.color }]} />
            <Text variant="xs" muted>
              {item.region}: {item.value}%
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
    gap: 16,
  },
  mapContainer: {
    width: 200,
    height: 120,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  region: {
    position: 'absolute',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 20,
  },
  northAmerica: {
    top: 10,
    left: 20,
    width: 60,
    height: 40,
  },
  europe: {
    top: 20,
    left: 80,
    width: 40,
    height: 25,
  },
  asia: {
    top: 15,
    left: 120,
    width: 50,
    height: 35,
  },
  other: {
    top: 60,
    left: 60,
    width: 80,
    height: 20,
  },
  regionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
