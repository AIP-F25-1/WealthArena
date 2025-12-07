/**
 * Duration Slider Component
 * Slider to select simulation duration (1-60 minutes)
 */

import React from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { Text, tokens, useTheme } from '@/src/design-system';

interface DurationSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function DurationSlider({
  value,
  onChange,
  min = 1,
  max = 60,
  label = 'Simulation Duration'
}: DurationSliderProps) {
  const { theme } = useTheme();
  const [sliderWidth, setSliderWidth] = React.useState(0);
  const padding = 12;
  const usableWidth = sliderWidth - (padding * 2);
  const position = ((value - min) / (max - min)) * usableWidth + padding;

  const updateValue = React.useCallback((x: number) => {
    if (sliderWidth === 0) return;
    const adjustedX = x - padding;
    const percentage = Math.max(0, Math.min(1, adjustedX / usableWidth));
    const newValue = Math.round(min + percentage * (max - min));
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [sliderWidth, padding, usableWidth, min, max, value, onChange]);

  const panResponder = React.useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        updateValue(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateValue(evt.nativeEvent.locationX);
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
    [updateValue]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="body" weight="semibold">{label}</Text>
        <Text variant="h3" weight="bold" color={theme.primary}>
          {value} min
        </Text>
      </View>

      <View
        style={styles.sliderContainer}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.trackFill, 
              { 
                backgroundColor: theme.primary,
                width: position
              }
            ]} 
          />
        </View>
        <View 
          style={[
            styles.thumb, 
            { 
              backgroundColor: theme.primary,
              left: position - 12
            }
          ]} 
        />
      </View>

      <View style={styles.labels}>
        <Text variant="xs" muted>{min} min</Text>
        <Text variant="xs" muted>{Math.floor((min + max) / 2)} min</Text>
        <Text variant="xs" muted>{max} min</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

