/**
 * Trade Log Panel Component
 * Displays trade events, AI actions, and market commentary
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Badge, tokens, useTheme } from '@/src/design-system';
import { TradeEvent, formatTimestamp } from '@/utils/simulationEngine';

interface TradeLogPanelProps {
  events: TradeEvent[];
  maxHeight?: number;
}

export function TradeLogPanel({ events, maxHeight = 300 }: TradeLogPanelProps) {
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [events.length]);

  const getEventIcon = (type: TradeEvent['type']) => {
    switch (type) {
      case 'user_buy':
        return <Ionicons name="arrow-up" size={16} color={theme.success} />;
      case 'user_sell':
        return <Ionicons name="arrow-down" size={16} color={theme.danger} />;
      case 'ai_buy':
        return <Ionicons name="trending-up" size={16} color={theme.primary} />;
      case 'ai_sell':
        return <Ionicons name="trending-down" size={16} color={theme.warning} />;
      case 'system':
        return <Ionicons name="information-circle" size={16} color={theme.textMuted} />;
      case 'commentary':
        return <Ionicons name="chatbox" size={16} color={theme.accent} />;
      default:
        return <Ionicons name="ellipse" size={16} color={theme.textMuted} />;
    }
  };

  const getTraderBadge = (trader: TradeEvent['trader']) => {
    switch (trader) {
      case 'user':
        return <Badge variant="success" size="small">YOU</Badge>;
      case 'ai':
        return <Badge variant="primary" size="small">AI</Badge>;
      case 'system':
        return <Badge variant="default" size="small">SYSTEM</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="list" size={20} color={theme.primary} />
        <Text variant="body" weight="semibold">Trade Log</Text>
        <Badge variant="default" size="small">{events.length}</Badge>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { maxHeight }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color={theme.textMuted} />
            <Text variant="small" muted center>
              No events yet. Start trading to see activity here.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <View
              key={event.id}
              style={[
                styles.eventItem,
                { 
                  backgroundColor: theme.cardHover,
                  borderLeftColor: getEventBorderColor(event.type, theme)
                }
              ]}
            >
              <View style={styles.eventHeader}>
                <View style={styles.eventIcon}>
                  {getEventIcon(event.type)}
                </View>
                {getTraderBadge(event.trader)}
                <Text variant="xs" muted style={styles.timestamp}>
                  {formatTimestamp(event.timestamp)}
                </Text>
              </View>
              
              <Text variant="small" style={styles.eventMessage}>
                {event.message}
              </Text>

              {(event.price || event.quantity) && (
                <View style={styles.eventDetails}>
                  {event.price && (
                    <Text variant="xs" muted>
                      Price: ${event.price.toFixed(2)}
                    </Text>
                  )}
                  {event.quantity && (
                    <Text variant="xs" muted>
                      Qty: {event.quantity}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </Card>
  );
}

function getEventBorderColor(type: TradeEvent['type'], theme: any): string {
  switch (type) {
    case 'user_buy':
      return theme.success;
    case 'user_sell':
      return theme.danger;
    case 'ai_buy':
      return theme.primary;
    case 'ai_sell':
      return theme.warning;
    case 'commentary':
      return theme.accent;
    default:
      return theme.border;
  }
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  eventItem: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderLeftWidth: 3,
    gap: tokens.spacing.xs,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  eventIcon: {
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timestamp: {
    marginLeft: 'auto',
  },
  eventMessage: {
    marginLeft: tokens.spacing.md,
  },
  eventDetails: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginLeft: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
});

