import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme, Text, Card, Badge, tokens } from '@/src/design-system';
import { LeaderboardEntry } from '../data/leaderboardData';

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  onPress?: () => void;
}

export default function LeaderboardCard({ entry, isCurrentUser = false, onPress }: LeaderboardCardProps) {
  const { theme } = useTheme();

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FFD700'; // Gold
      case 2:
        return '#C0C0C0'; // Silver
      case 3:
        return '#CD7F32'; // Bronze
      default:
        return theme.primary;
    }
  };

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={[
        styles.card,
        isCurrentUser && { borderColor: theme.primary, borderWidth: 2 }
      ]}>
        <View style={styles.content}>
          <View style={styles.leftSection}>
            <View style={[styles.rankBadge, { backgroundColor: getRankColor(entry.rank) + '20' }]}>
              <Text variant="body" weight="bold" color={getRankColor(entry.rank)}>
                {getRankIcon(entry.rank)}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <Text variant="body" weight="semibold" numberOfLines={1}>
                  {entry.name}
                </Text>
                {entry.badge && (
                  <Badge 
                    variant={entry.rank <= 3 ? 'success' : entry.rank <= 10 ? 'warning' : 'secondary'} 
                    size="small"
                  >
                    {entry.badge}
                  </Badge>
                )}
              </View>
              <Text variant="small" muted>
                {entry.totalTrades} trades • {entry.winRate}% win rate
              </Text>
            </View>
          </View>

          <View style={styles.rightSection}>
            <View style={styles.xpSection}>
              <Text variant="body" weight="bold" color={theme.primary}>
                {entry.xp.toLocaleString()} XP
              </Text>
              {entry.streak && entry.streak > 1 && (
                <Text variant="xs" color={theme.accent}>
                  🔥 {entry.streak} streak
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: tokens.spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: tokens.spacing.sm,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
  xpSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
