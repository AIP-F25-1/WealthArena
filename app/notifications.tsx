import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';

interface Notification {
  id: string;
  type: 'market' | 'portfolio' | 'achievement' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'achievement',
    title: 'New Badge Unlocked!',
    message: 'You earned the "First Trade" badge! +50 XP',
    timestamp: '10 min ago',
    read: false,
  },
  {
    id: '2',
    type: 'market',
    title: 'Market Alert',
    message: 'AAPL is up 3.2% today. Great time to review your position!',
    timestamp: '1 hour ago',
    read: false,
  },
  {
    id: '3',
    type: 'portfolio',
    title: 'Portfolio Update',
    message: 'Your portfolio is up 2.5% this week. Great job!',
    timestamp: '2 hours ago',
    read: false,
  },
  {
    id: '4',
    type: 'achievement',
    title: '7-Day Streak!',
    message: 'You completed a 7-day learning streak! Keep it up!',
    timestamp: 'Yesterday',
    read: true,
  },
  {
    id: '5',
    type: 'system',
    title: 'New Features Available',
    message: 'Check out the new strategy lab and technical analysis tools!',
    timestamp: '2 days ago',
    read: true,
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getIconName = (type: string) => {
    switch (type) {
      case 'market': return 'market';
      case 'portfolio': return 'portfolio';
      case 'achievement': return 'trophy';
      case 'system': return 'settings';
      default: return 'settings';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'market': return theme.primary;
      case 'portfolio': return theme.accent;
      case 'achievement': return theme.yellow;
      case 'system': return theme.muted;
      default: return theme.text;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <Card style={styles.headerCard} elevation="med">
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Icon name="bell" size={32} color={theme.primary} />
              <View>
                <Text variant="h3" weight="bold">Notifications</Text>
                <Text variant="small" muted>
                  {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
                </Text>
              </View>
            </View>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="small"
                onPress={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </View>
        </Card>

        {/* Notifications List */}
        {notifications.map((notification) => (
          <Card 
            key={notification.id}
            style={[
              styles.notificationCard,
              !notification.read && { ...styles.unreadCard, borderLeftWidth: 3, borderLeftColor: theme.primary }
            ]}
          >
            <View style={styles.notificationContent}>
              <View style={[styles.iconCircle, { backgroundColor: getIconColor(notification.type) + '20' }]}>
                <Icon name={getIconName(notification.type) as any} size={24} color={getIconColor(notification.type)} />
              </View>
              
              <View style={styles.notificationText}>
                <View style={styles.notificationHeader}>
                  <Text variant="body" weight="semibold">{notification.title}</Text>
                  {!notification.read && (
                    <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                  )}
                </View>
                <Text variant="small" muted style={styles.notificationMessage}>
                  {notification.message}
                </Text>
                <Text variant="xs" muted style={styles.timestamp}>
                  {notification.timestamp}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        {/* Empty State */}
        {notifications.length === 0 && (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={48} color={theme.muted} />
            <Text variant="h3" weight="semibold" center>No Notifications</Text>
            <Text variant="small" muted center>
              You're all caught up! We'll notify you when something important happens.
            </Text>
          </Card>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  headerCard: {
    marginBottom: tokens.spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    flex: 1,
  },
  notificationCard: {
    borderLeftWidth: 0,
  },
  unreadCard: {},
  notificationContent: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    flex: 1,
    gap: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    lineHeight: 18,
  },
  timestamp: {
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xl,
  },
});
