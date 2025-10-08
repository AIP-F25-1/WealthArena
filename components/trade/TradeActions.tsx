/**
 * Trade Actions Component
 * Buy, Sell, and Close Position buttons with quantity input
 */

import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, TextInput, Card, tokens, useTheme } from '@/src/design-system';

interface TradeActionsProps {
  currentPrice: number;
  balance: number;
  hasOpenPositions: boolean;
  onBuy: (quantity: number) => void;
  onSell: (quantity: number) => void;
  onCloseAll: () => void;
  disabled?: boolean;
}

export function TradeActions({
  currentPrice,
  balance,
  hasOpenPositions,
  onBuy,
  onSell,
  onCloseAll,
  disabled = false
}: TradeActionsProps) {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('1');

  const handleOpenModal = (type: 'buy' | 'sell') => {
    setOrderType(type);
    setShowModal(true);
  };

  const handleConfirm = () => {
    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) return;

    if (orderType === 'buy') {
      onBuy(qty);
    } else {
      onSell(qty);
    }

    setQuantity('1');
    setShowModal(false);
  };

  const estimatedCost = (parseFloat(quantity) || 0) * currentPrice;
  const canAfford = estimatedCost <= balance;

  return (
    <>
      <View style={styles.container}>
        {/* Quick Trade Buttons */}
        <View style={styles.buttonRow}>
          <Button
            variant="success"
            size="large"
            fullWidth
            onPress={() => handleOpenModal('buy')}
            disabled={disabled}
            icon={<Ionicons name="arrow-up" size={20} color={theme.bg} />}
          >
            Buy
          </Button>

          <Button
            variant="danger"
            size="large"
            fullWidth
            onPress={() => handleOpenModal('sell')}
            disabled={disabled}
            icon={<Ionicons name="arrow-down" size={20} color={theme.bg} />}
          >
            Sell
          </Button>
        </View>

        {/* Close All Button */}
        {hasOpenPositions && (
          <Button
            variant="secondary"
            size="medium"
            fullWidth
            onPress={onCloseAll}
            disabled={disabled}
            icon={<Ionicons name="close-circle" size={18} color={theme.text} />}
          >
            Close All Positions
          </Button>
        )}
      </View>

      {/* Order Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop}
            onPress={() => setShowModal(false)}
          />
          <View style={styles.modalContainer}>
            <Card style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text variant="h3" weight="bold">
                  {orderType === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
                </Text>
                <Pressable onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.priceInfo}>
                <Text variant="small" muted>Current Price</Text>
                <Text variant="h3" weight="bold">${currentPrice.toFixed(2)}</Text>
              </View>

              <TextInput
                label="Quantity"
                placeholder="Enter quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
              />

              <View style={[styles.estimateBox, { backgroundColor: theme.cardHover }]}>
                <View style={styles.estimateRow}>
                  <Text variant="small" muted>Total Cost</Text>
                  <Text variant="body" weight="semibold">
                    ${estimatedCost.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.estimateRow}>
                  <Text variant="small" muted>Available Balance</Text>
                  <Text 
                    variant="body" 
                    weight="semibold"
                    color={canAfford ? theme.success : theme.danger}
                  >
                    ${balance.toFixed(2)}
                  </Text>
                </View>
              </View>

              {!canAfford && orderType === 'buy' && (
                <View style={[styles.warning, { backgroundColor: theme.danger + '20' }]}>
                  <Ionicons name="warning" size={16} color={theme.danger} />
                  <Text variant="xs" color={theme.danger}>
                    Insufficient balance
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Button
                  variant="secondary"
                  size="medium"
                  fullWidth
                  onPress={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant={orderType === 'buy' ? 'success' : 'danger'}
                  size="medium"
                  fullWidth
                  onPress={handleConfirm}
                  disabled={!canAfford && orderType === 'buy'}
                >
                  Confirm {orderType === 'buy' ? 'Buy' : 'Sell'}
                </Button>
              </View>
            </Card>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    zIndex: 1,
  },
  modalContent: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceInfo: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  estimateBox: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.sm,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
});

