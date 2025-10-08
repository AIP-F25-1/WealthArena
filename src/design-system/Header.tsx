// Header Component - Top navigation with greeting and actions
import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';
import { FoxMascot } from './mascots/index';
import { tokens } from './tokens';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export interface HeaderProps {
  greeting?: string;
  userName?: string;
  showNotifications?: boolean;
  showSearch?: boolean;
  onNotificationPress?: () => void;
  onSearchPress?: () => void;
  avatar?: string;
  lastUpdated?: string;
  marketStatus?: 'open' | 'closed' | 'pre' | 'post' | 'unknown';
}

export const Header = ({
  greeting = 'Good day',
  userName = 'Trader',
  showNotifications = true,
  showSearch = false,
  onNotificationPress,
  onSearchPress,
  avatar,
  lastUpdated,
  marketStatus,
}: HeaderProps) => {
  const { theme } = useTheme();
  const router = useRouter();

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      router.push('/notifications');
    }
  };

  const getStatusMeta = () => {
    switch (marketStatus) {
      case 'open':
        return { color: '#22C55E', label: 'Open' };
      case 'closed':
        return { color: '#EF4444', label: 'Closed' };
      case 'pre':
        return { color: '#F59E0B', label: 'Pre' };
      case 'post':
        return { color: '#3B82F6', label: 'Post' };
      default:
        return { color: theme.muted, label: 'Unknown' };
    }
  };

  const statusMeta = getStatusMeta();

  return (
    <View style={[styles.header, { backgroundColor: theme.bg }]}>
      <Pressable 
        style={styles.left}
        onPress={() => router.push('/user-profile')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.mascotContainer}>
            <FoxMascot variant="neutral" size={40} />
          </View>
        )}
        <View style={styles.greeting}>
          <Text variant="small" muted>{greeting}</Text>
          <Text variant="h3" weight="semibold">{userName}</Text>
          {lastUpdated ? (
            <Text variant="small" muted style={styles.lastUpdated}>
              Last Updated: {lastUpdated}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.right}>
        <View style={styles.rightTop}>
          {showSearch && (
            <Pressable 
              onPress={onSearchPress}
              style={({ pressed }) => [
                styles.iconButton,
                { opacity: pressed ? 0.6 : 1 }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Icon name="market" size={20} color={theme.text} />
            </Pressable>
          )}
          {showNotifications && (
            <Pressable 
              onPress={handleNotificationPress}
              style={({ pressed }) => [
                styles.iconButton,
                { opacity: pressed ? 0.6 : 1 }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <View>
                <Ionicons name="notifications" size={22} color={theme.text} />
                {/* Notification badge */}
                <View style={[styles.notificationBadge, { backgroundColor: '#FF4B4B' }]}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>
        
        {/* Market Status Pill - positioned under notification bell */}
        <View style={[styles.marketStatusPill, { backgroundColor: theme.surface }]}>
          <View style={[styles.statusIndicator, { backgroundColor: statusMeta.color }]} />
          <Text variant="small" weight="semibold" style={styles.marketStatusText}>
            Market {statusMeta.label}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: tokens.spacing.sm,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: tokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotContainer: {
    width: 40,
    height: 40,
    marginRight: tokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: tokens.spacing.xs,
  },
  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: tokens.spacing.xs,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  lastUpdated: {
    marginTop: tokens.spacing.xs,
  },
  marketStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 16,
    marginRight: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(11, 160, 78, 0.3)',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: tokens.spacing.xs,
  },
  marketStatusText: {
    fontSize: 12,
  },
});

