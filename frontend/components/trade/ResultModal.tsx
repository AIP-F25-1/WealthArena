/**
 * Result Modal Component
 * Displays end-of-simulation results with statistics
 */

import React from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, Badge, tokens, useTheme } from '@/src/design-system';

interface ResultModalProps {
  visible: boolean;
  onClose: () => void;
  onPlayAgain?: () => void;
  
  // Results data
  winner?: 'user' | 'ai' | 'tie';
  userPnL: number;
  userBalance: number;
  userTrades: number;
  aiPnL?: number;
  aiBalance?: number;
  aiTrades?: number;
  
  // Mode
  mode: 'simulator' | 'vsai';
}

export function ResultModal(props: Readonly<ResultModalProps>) {
  const {
    visible,
    onClose,
    onPlayAgain,
    winner,
    userPnL,
    userBalance,
    userTrades,
    aiPnL,
    aiBalance,
    aiTrades,
    mode,
  } = props;
  const { theme } = useTheme();

  const isVsAI = mode === 'vsai';
  const userWon = winner === 'user';
  const isTie = winner === 'tie';

  let iconName: any = 'checkmark-circle';
  if (isVsAI) {
    iconName = userWon ? 'trophy' : 'ribbon';
  }

  const getWinnerText = () => {
    if (!isVsAI) return 'Simulation Complete!';
    if (isTie) return "It's a Tie!";
    if (userWon) return 'You Win! 🎉';
    return 'AI Wins 🤖';
  };

  const getWinnerColor = () => {
    if (!isVsAI) {
      return theme.primary;
    }
    if (isTie) {
      return theme.warning;
    }
    if (userWon) {
      return theme.success;
    }
    return theme.danger;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <Card style={StyleSheet.flatten([styles.modal, { backgroundColor: theme.card }])}>
          <View style={styles.modalBody}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: getWinnerColor() + '20' }]}>
              <Ionicons 
                name={iconName} 
                size={48} 
                color={getWinnerColor()} 
              />
            </View>
            <Text variant="h2" weight="bold" center color={getWinnerColor()}>
              {getWinnerText()}
            </Text>
          </View>

          {/* User Stats */}
          <View style={[styles.statsSection, { backgroundColor: theme.cardHover }]}>
            <Text variant="body" weight="semibold" center>Your Performance</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="small" muted>P&L</Text>
                <Text 
                  variant="h3" 
                  weight="bold"
                  color={userPnL >= 0 ? theme.success : theme.danger}
                >
                  {userPnL >= 0 ? '+' : ''}${userPnL.toFixed(2)}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="small" muted>Final Balance</Text>
                <Text variant="h3" weight="bold">
                  ${userBalance.toFixed(2)}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="small" muted>Trades Made</Text>
                <Text variant="h3" weight="bold" color={theme.primary}>
                  {userTrades}
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text variant="small" muted>Win Rate</Text>
                <Text variant="h3" weight="bold" color={theme.accent}>
                  {userPnL >= 0 ? '100%' : '0%'}
                </Text>
              </View>
            </View>
          </View>

          {/* AI Stats (vs AI mode) */}
          {isVsAI && (
            <View style={[styles.statsSection, { backgroundColor: theme.cardHover }]}>
              <Text variant="body" weight="semibold" center>AI Performance</Text>
              
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text variant="small" muted>P&L</Text>
                  <Text 
                    variant="h3" 
                    weight="bold"
                    color={(aiPnL || 0) >= 0 ? theme.success : theme.danger}
                  >
                    {(aiPnL || 0) >= 0 ? '+' : ''}${(aiPnL || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text variant="small" muted>Final Balance</Text>
                  <Text variant="h3" weight="bold">
                    ${(aiBalance || 0).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.statItem}>
                  <Text variant="small" muted>Trades Made</Text>
                  <Text variant="h3" weight="bold" color={theme.primary}>
                    {aiTrades || 0}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Performance Badge */}
          <View style={styles.badgeContainer}>
            {userPnL > 1000 && (
              <Badge variant="success" size="large">🏆 Excellent Trader</Badge>
            )}
            {userPnL > 0 && userPnL <= 1000 && (
              <Badge variant="primary" size="large">👍 Profitable</Badge>
            )}
            {userPnL <= 0 && userPnL > -1000 && (
              <Badge variant="warning" size="large">📚 Keep Learning</Badge>
            )}
            {userPnL <= -1000 && (
              <Badge variant="danger" size="large">💪 Try Again</Badge>
            )}
          </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {onPlayAgain && (
              <Button
                variant="primary"
                size="large"
                style={styles.buttonInRow}
                onPress={onPlayAgain}
                icon={<Ionicons name="play" size={20} color={theme.bg} />}
              >
                Play Again
              </Button>
            )}
            <Button
              variant="secondary"
              size="large"
              style={styles.buttonInRow}
              onPress={onClose}
            >
              Close
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    padding: tokens.spacing.lg,
    zIndex: 1,
  },
  modalBody: {
    flexShrink: 1,
    gap: tokens.spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsSection: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    gap: tokens.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  badgeContainer: {
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    justifyContent: 'space-between',
    marginTop: tokens.spacing.md,
  },
  buttonInRow: {
    flex: 1,
  },
});

