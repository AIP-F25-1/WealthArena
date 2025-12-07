import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';
import { apiService } from '@/services/apiService';

interface Notification {
  id: string;
  type: 'market' | 'portfolio' | 'achievement' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Format timestamp helper
  const formatTimestamp = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getNotifications({ limit: 50 });
      
      // Map backend notifications to UI format
      const mappedNotifications: Notification[] = (data.notifications || data || []).map((notif: any) => ({
        id: String(notif.NotificationID || notif.id || notif.notificationId),
        type: (notif.Type || notif.type || 'system') as Notification['type'],
        title: notif.Title || notif.title || 'Notification',
        message: notif.Message || notif.message || notif.message || '',
        timestamp: formatTimestamp(notif.CreatedAt || notif.createdAt || notif.timestamp || new Date()),
        read: notif.IsRead || notif.isRead || notif.read || false,
      }));

      setNotifications(mappedNotifications);
      
      // Update unread count
      const count = mappedNotifications.filter(n => !n.read).length;
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    try {
      await apiService.markNotificationRead(id);
      // Update local state immediately
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
      // Refresh unread count
      const newUnreadCount = await apiService.getUnreadNotificationCount();
      setUnreadCount(newUnreadCount.count || newUnreadCount || 0);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Polling for unread count
  useEffect(() => {
    const pollUnreadCount = async () => {
      try {
        const count = await apiService.getUnreadNotificationCount();
        const unreadCountValue = count.count || count || 0;
        if (unreadCountValue !== unreadCount) {
          // Refresh notifications if count changed
          await fetchNotifications();
        }
      } catch (error) {
        console.error('Failed to poll unread count:', error);
      }
    };

    // Poll every 30 seconds
    const interval = setInterval(pollUnreadCount, 30000);

    // Initial poll
    pollUnreadCount();

    return () => clearInterval(interval);
  }, [unreadCount]);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
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
          headerShown: false,
        }}
      />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
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
          <Pressable 
            key={notification.id}
            onPress={() => markAsRead(notification.id)}
          >
            <Card 
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
          </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    height: 56,
  },
  backButton: {
    padding: tokens.spacing.xs,
    marginLeft: -tokens.spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: tokens.spacing.md,
  },
  headerRight: {
    width: 40,
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
