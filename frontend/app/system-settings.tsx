import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, tokens } from '@/src/design-system';

interface SystemSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  category: 'security' | 'performance' | 'notifications' | 'maintenance';
}

const SYSTEM_SETTINGS: SystemSetting[] = [
  {
    id: '1',
    title: 'Two-Factor Authentication',
    description: 'Require 2FA for all admin accounts',
    enabled: true,
    category: 'security'
  },
  {
    id: '2',
    title: 'Auto-Logout',
    description: 'Automatically logout inactive sessions after 30 minutes',
    enabled: true,
    category: 'security'
  },
  {
    id: '3',
    title: 'API Rate Limiting',
    description: 'Limit API requests to prevent abuse',
    enabled: true,
    category: 'performance'
  },
  {
    id: '4',
    title: 'Database Optimization',
    description: 'Automatically optimize database queries',
    enabled: false,
    category: 'performance'
  },
  {
    id: '5',
    title: 'Error Notifications',
    description: 'Send email alerts for system errors',
    enabled: true,
    category: 'notifications'
  },
  {
    id: '6',
    title: 'Maintenance Mode',
    description: 'Enable maintenance mode for system updates',
    enabled: false,
    category: 'maintenance'
  }
];

export default function SystemSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [settings, setSettings] = useState<SystemSetting[]>(SYSTEM_SETTINGS);

  const toggleSetting = (id: string) => {
    setSettings(prev => 
      prev.map(setting => 
        setting.id === id 
          ? { ...setting, enabled: !setting.enabled }
          : setting
      )
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return 'shield';
      case 'performance': return 'speedometer';
      case 'notifications': return 'notifications';
      case 'maintenance': return 'construct';
      default: return 'settings';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security': return theme.danger;
      case 'performance': return theme.primary;
      case 'notifications': return theme.yellow;
      case 'maintenance': return theme.accent;
      default: return theme.text;
    }
  };

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>System Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={{ ...styles.headerCard, borderColor: theme.primary, borderWidth: 2 }} elevation="med">
          <Icon name="settings" size={36} color={theme.primary} />
          <Text variant="h2" weight="bold">System Settings</Text>
          <Text variant="small" muted center>Configure system-wide settings and preferences</Text>
        </Card>

        {/* Settings by Category */}
        {Object.entries(groupedSettings).map(([category, categorySettings]) => (
          <Card key={category} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Icon 
                name={getCategoryIcon(category)} 
                size={24} 
                color={getCategoryColor(category)} 
              />
              <Text variant="h3" weight="semibold" style={{ textTransform: 'capitalize' }}>
                {category}
              </Text>
            </View>

            {categorySettings.map((setting) => (
              <View key={setting.id} style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text variant="body" weight="semibold">{setting.title}</Text>
                  <Text variant="xs" muted>{setting.description}</Text>
                </View>
                <Switch
                  value={setting.enabled}
                  onValueChange={() => toggleSetting(setting.id)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={setting.enabled ? theme.bg : theme.text}
                />
              </View>
            ))}
          </Card>
        ))}

        {/* Action Buttons */}
        <Card style={styles.actionsCard}>
          <Button
            variant="primary"
            size="medium"
            fullWidth
            icon={<Icon name="save" size={18} color={theme.bg} />}
          >
            Save Changes
          </Button>

          <Button
            variant="secondary"
            size="medium"
            fullWidth
            icon={<Icon name="refresh" size={18} color={theme.primary} />}
          >
            Reset to Defaults
          </Button>
        </Card>

        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  categoryCard: {
    gap: tokens.spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#00000005',
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  actionsCard: {
    gap: tokens.spacing.sm,
  },
});
