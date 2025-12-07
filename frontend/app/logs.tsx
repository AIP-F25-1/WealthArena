import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  source: string;
  userId?: string;
}

const LOG_ENTRIES: LogEntry[] = [
  {
    id: '1',
    timestamp: '2024-01-15 14:30:25',
    level: 'error',
    message: 'Database connection timeout',
    source: 'DatabaseService',
    userId: 'user_123'
  },
  {
    id: '2',
    timestamp: '2024-01-15 14:29:18',
    level: 'warning',
    message: 'High memory usage detected',
    source: 'SystemMonitor',
  },
  {
    id: '3',
    timestamp: '2024-01-15 14:28:45',
    level: 'info',
    message: 'User login successful',
    source: 'AuthService',
    userId: 'user_456'
  },
  {
    id: '4',
    timestamp: '2024-01-15 14:27:32',
    level: 'debug',
    message: 'API request processed',
    source: 'APIGateway',
    userId: 'user_789'
  },
  {
    id: '5',
    timestamp: '2024-01-15 14:26:15',
    level: 'error',
    message: 'Failed to process payment',
    source: 'PaymentService',
    userId: 'user_321'
  },
  {
    id: '6',
    timestamp: '2024-01-15 14:25:08',
    level: 'info',
    message: 'System backup completed',
    source: 'BackupService',
  },
  {
    id: '7',
    timestamp: '2024-01-15 14:24:52',
    level: 'warning',
    message: 'Slow query detected',
    source: 'DatabaseService',
  },
  {
    id: '8',
    timestamp: '2024-01-15 14:23:41',
    level: 'info',
    message: 'New user registration',
    source: 'UserService',
    userId: 'user_654'
  }
];

export default function LogsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>(LOG_ENTRIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const getLevelVariant = (level: string): 'success' | 'warning' | 'danger' | 'secondary' => {
    switch (level) {
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'success';
      case 'debug': return 'secondary';
      default: return 'secondary';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return 'alert-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      case 'debug': return 'bug';
      default: return 'document';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = !selectedLevel || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    // In a real app, this would export logs to a file
    console.log('Exporting logs...');
  };

  const levels = ['error', 'warning', 'info', 'debug'];

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>System Logs</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={{ ...styles.headerCard, borderColor: theme.yellow, borderWidth: 2 }} elevation="med">
          <Icon name="document" size={36} color={theme.yellow} />
          <Text variant="h2" weight="bold">System Logs</Text>
          <Text variant="small" muted center>Monitor system activity and debug issues</Text>
        </Card>

        {/* Search and Filters */}
        <Card style={styles.filtersCard}>
          <TextInput
            style={[styles.searchInput, { 
              backgroundColor: theme.surface, 
              color: theme.text,
              borderColor: theme.border 
            }]}
            placeholder="Search logs..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levelFilters}>
            <Button
              variant={selectedLevel === null ? 'primary' : 'secondary'}
              size="small"
              onPress={() => setSelectedLevel(null)}
            >
              All
            </Button>
            {levels.map(level => (
              <Button
                key={level}
                variant={selectedLevel === level ? 'primary' : 'secondary'}
                size="small"
                onPress={() => setSelectedLevel(selectedLevel === level ? null : level)}
              >
                {level.toUpperCase()}
              </Button>
            ))}
          </ScrollView>
        </Card>

        {/* Log Entries */}
        <Card style={styles.logsCard}>
          <View style={styles.logsHeader}>
            <Text variant="h3" weight="semibold">Log Entries ({filteredLogs.length})</Text>
            <View style={styles.logsActions}>
              <Button
                variant="secondary"
                size="small"
                icon={<Icon name="download" size={16} color={theme.primary} />}
                onPress={exportLogs}
              >
                Export
              </Button>
              <Button
                variant="secondary"
                size="small"
                icon={<Icon name="trash" size={16} color={theme.danger} />}
                onPress={clearLogs}
              >
                Clear
              </Button>
            </View>
          </View>

          {filteredLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="document" size={48} color={theme.textMuted} />
              <Text variant="body" muted center>No logs found</Text>
            </View>
          ) : (
            filteredLogs.map((log) => (
              <View key={log.id} style={styles.logEntry}>
                <View style={styles.logHeader}>
                  <View style={styles.logLevel}>
                    <Icon 
                      name={getLevelIcon(log.level)} 
                      size={16} 
                      color={theme.text} 
                    />
                    <Badge variant={getLevelVariant(log.level)} size="small">
                      {log.level.toUpperCase()}
                    </Badge>
                  </View>
                  <Text variant="xs" muted>{log.timestamp}</Text>
                </View>
                
                <Text variant="body" weight="semibold" style={styles.logMessage}>
                  {log.message}
                </Text>
                
                <View style={styles.logMeta}>
                  <Text variant="xs" muted>Source: {log.source}</Text>
                  {log.userId && (
                    <Text variant="xs" muted>User: {log.userId}</Text>
                  )}
                </View>
              </View>
            ))
          )}
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
  filtersCard: {
    gap: tokens.spacing.sm,
  },
  searchInput: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: 16,
  },
  levelFilters: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  logsCard: {
    gap: tokens.spacing.sm,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logsActions: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  logEntry: {
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#00000005',
    gap: tokens.spacing.xs,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  logMessage: {
    marginTop: tokens.spacing.xs,
  },
  logMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
});
