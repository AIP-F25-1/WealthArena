// FoxCoach Component - Mascot with helpful messages
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Card } from './Card';
import { Text } from './Text';
import { tokens } from './tokens';
import { FoxMascot, FoxVariant } from './mascots';

export interface FoxCoachProps {
  message: string;
  variant?: FoxVariant;
  size?: number;
}

export const FoxCoach = ({ 
  message, 
  variant = 'neutral',
  size = 80,
}: FoxCoachProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.foxContainer}>
        <FoxMascot variant={variant} size={size} />
      </View>
      <Card style={styles.bubble} padding="sm">
        <Text variant="small">{message}</Text>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  foxContainer: {
    marginRight: tokens.spacing.sm,
  },
  bubble: {
    flex: 1,
    maxWidth: '80%',
  },
});

