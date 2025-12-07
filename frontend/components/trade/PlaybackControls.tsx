/**
 * Playback Controls Component
 * Play, Pause, Rewind, Fast-Forward, and Speed controls
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, tokens, useTheme } from '@/src/design-system';
import { PlaybackSpeed, PlaybackState } from '@/utils/simulationEngine';

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  progress: number;
  currentIndex: number;
  totalCandles: number;
  onPlay: () => void;
  onPause: () => void;
  onRewind: () => void;
  onFastForward: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onReset?: () => void;
}

export function PlaybackControls({
  playbackState,
  playbackSpeed,
  progress,
  currentIndex,
  totalCandles,
  onPlay,
  onPause,
  onRewind,
  onFastForward,
  onSpeedChange,
  onReset
}: PlaybackControlsProps) {
  const { theme } = useTheme();

  const speeds: PlaybackSpeed[] = [1, 2, 5, 10];

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                backgroundColor: theme.primary,
                width: `${progress}%` 
              }
            ]} 
          />
        </View>
        <Text variant="xs" muted>
          {currentIndex + 1} / {totalCandles}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        {/* Rewind */}
        <Pressable
          onPress={onRewind}
          style={[styles.controlButton, { backgroundColor: theme.cardHover }]}
          disabled={currentIndex === 0}
        >
          <Ionicons 
            name="play-back" 
            size={24} 
            color={currentIndex === 0 ? theme.textMuted : theme.text} 
          />
        </Pressable>

        {/* Play/Pause */}
        <Pressable
          onPress={playbackState === 'playing' ? onPause : onPlay}
          style={[
            styles.controlButton, 
            styles.playButton,
            { backgroundColor: theme.primary }
          ]}
          disabled={playbackState === 'completed'}
        >
          <Ionicons 
            name={playbackState === 'playing' ? 'pause' : 'play'} 
            size={28} 
            color={theme.bg} 
          />
        </Pressable>

        {/* Fast Forward */}
        <Pressable
          onPress={onFastForward}
          style={[styles.controlButton, { backgroundColor: theme.cardHover }]}
          disabled={currentIndex >= totalCandles - 1}
        >
          <Ionicons 
            name="play-forward" 
            size={24} 
            color={currentIndex >= totalCandles - 1 ? theme.textMuted : theme.text} 
          />
        </Pressable>

        {/* Reset */}
        {onReset && (
          <Pressable
            onPress={onReset}
            style={[styles.controlButton, { backgroundColor: theme.cardHover }]}
          >
            <Ionicons name="refresh" size={24} color={theme.text} />
          </Pressable>
        )}
      </View>

      {/* Speed Controls */}
      <View style={styles.speedContainer}>
        <Text variant="xs" muted style={styles.speedLabel}>
          Speed:
        </Text>
        <View style={styles.speedButtons}>
          {speeds.map((speed) => (
            <Pressable
              key={speed}
              onPress={() => onSpeedChange(speed)}
              style={[
                styles.speedButton,
                {
                  backgroundColor: playbackSpeed === speed ? theme.primary : theme.cardHover,
                  borderColor: theme.border
                }
              ]}
            >
              <Text 
                variant="xs" 
                weight="semibold"
                color={playbackSpeed === speed ? theme.bg : theme.text}
              >
                {speed}×
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    gap: tokens.spacing.md,
  },
  progressContainer: {
    gap: tokens.spacing.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  speedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  speedLabel: {
    marginRight: tokens.spacing.xs,
  },
  speedButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  speedButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    minWidth: 44,
    alignItems: 'center',
  },
});

