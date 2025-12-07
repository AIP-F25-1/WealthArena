import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, Badge, tokens } from '@/src/design-system';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
  status: 'active' | 'inactive' | 'banned';
  joinDate: string;
  lastActive: string;
  totalTrades: number;
  winRate: number;
}

const USERS: User[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    role: 'admin',
    status: 'active',
    joinDate: '2023-01-15',
    lastActive: '2024-01-15 14:30',
    totalTrades: 1247,
    winRate: 78.5
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    role: 'moderator',
    status: 'active',
    joinDate: '2023-03-22',
    lastActive: '2024-01-15 13:45',
    totalTrades: 892,
    winRate: 82.1
  },
  {
    id: '3',
    name: 'Mike Chen',
    email: 'mike.chen@email.com',
    role: 'user',
    status: 'active',
    joinDate: '2023-06-10',
    lastActive: '2024-01-15 12:20',
    totalTrades: 456,
    winRate: 65.3
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.davis@email.com',
    role: 'user',
    status: 'inactive',
    joinDate: '2023-08-05',
    lastActive: '2024-01-10 09:15',
    totalTrades: 234,
    winRate: 71.8
  },
  {
    id: '5',
    name: 'Alex Rodriguez',
    email: 'alex.r@email.com',
    role: 'user',
    status: 'banned',
    joinDate: '2023-11-12',
    lastActive: '2024-01-08 16:30',
    totalTrades: 89,
    winRate: 45.2
  }
];

export default function UserManagementScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>(USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const getRoleVariant = (role: string): 'success' | 'warning' | 'secondary' => {
    switch (role) {
      case 'admin': return 'success';
      case 'moderator': return 'warning';
      case 'user': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'banned': return 'danger';
      default: return 'secondary';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !selectedRole || user.role === selectedRole;
    const matchesStatus = !selectedStatus || user.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const updateUserStatus = (userId: string, newStatus: User['status']) => {
    setUsers(prev => 
      prev.map(user => 
        user.id === userId 
          ? { ...user, status: newStatus }
          : user
      )
    );
  };

  const updateUserRole = (userId: string, newRole: User['role']) => {
    setUsers(prev => 
      prev.map(user => 
        user.id === userId 
          ? { ...user, role: newRole }
          : user
      )
    );
  };

  const roles = ['admin', 'moderator', 'user'];
  const statuses = ['active', 'inactive', 'banned'];

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>User Management</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={{ ...styles.headerCard, borderColor: theme.accent, borderWidth: 2 }} elevation="med">
          <Icon name="agent" size={36} color={theme.accent} />
          <Text variant="h2" weight="bold">User Management</Text>
          <Text variant="small" muted center>Manage users, roles, and permissions</Text>
        </Card>

        {/* Search and Filters */}
        <Card style={styles.filtersCard}>
          <TextInput
            style={[styles.searchInput, { 
              backgroundColor: theme.surface, 
              color: theme.text,
              borderColor: theme.border 
            }]}
            placeholder="Search users..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleFilters}>
              <Button
                variant={selectedRole === null ? 'primary' : 'secondary'}
                size="small"
                onPress={() => setSelectedRole(null)}
              >
                All Roles
              </Button>
              {roles.map(role => (
                <Button
                  key={role}
                  variant={selectedRole === role ? 'primary' : 'secondary'}
                  size="small"
                  onPress={() => setSelectedRole(selectedRole === role ? null : role)}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Button>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
              <Button
                variant={selectedStatus === null ? 'primary' : 'secondary'}
                size="small"
                onPress={() => setSelectedStatus(null)}
              >
                All Status
              </Button>
              {statuses.map(status => (
                <Button
                  key={status}
                  variant={selectedStatus === status ? 'primary' : 'secondary'}
                  size="small"
                  onPress={() => setSelectedStatus(selectedStatus === status ? null : status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </ScrollView>
          </View>
        </Card>

        {/* User Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Icon name="agent" size={24} color={theme.primary} />
            <Text variant="h3" weight="bold">{users.length}</Text>
            <Text variant="small" muted center>Total Users</Text>
          </Card>

          <Card style={styles.statCard}>
            <Icon name="checkmark-circle" size={24} color={theme.success} />
            <Text variant="h3" weight="bold">{users.filter(u => u.status === 'active').length}</Text>
            <Text variant="small" muted center>Active</Text>
          </Card>

          <Card style={styles.statCard}>
            <Icon name="shield" size={24} color={theme.warning} />
            <Text variant="h3" weight="bold">{users.filter(u => u.role === 'admin' || u.role === 'moderator').length}</Text>
            <Text variant="small" muted center>Staff</Text>
          </Card>
        </View>

        {/* User List */}
        <Card style={styles.usersCard}>
          <View style={styles.usersHeader}>
            <Text variant="h3" weight="semibold">Users ({filteredUsers.length})</Text>
          </View>

          {filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="agent" size={48} color={theme.textMuted} />
              <Text variant="body" muted center>No users found</Text>
            </View>
          ) : (
            filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <Text variant="body" weight="semibold">{user.name}</Text>
                    <Text variant="xs" muted>{user.email}</Text>
                  </View>
                  <View style={styles.userBadges}>
                    <Badge variant={getRoleVariant(user.role)} size="small">
                      {user.role.toUpperCase()}
                    </Badge>
                    <Badge variant={getStatusVariant(user.status)} size="small">
                      {user.status.toUpperCase()}
                    </Badge>
                  </View>
                </View>

                <View style={styles.userStats}>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Join Date</Text>
                    <Text variant="xs">{user.joinDate}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Last Active</Text>
                    <Text variant="xs">{user.lastActive}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Trades</Text>
                    <Text variant="xs">{user.totalTrades}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="xs" muted>Win Rate</Text>
                    <Text variant="xs">{user.winRate}%</Text>
                  </View>
                </View>

                <View style={styles.userActions}>
                  <Button
                    variant="secondary"
                    size="small"
                    icon={<Icon name="construct" size={16} color={theme.primary} />}
                    onPress={() => {
                      const newRole = user.role === 'user' ? 'moderator' : 
                                    user.role === 'moderator' ? 'admin' : 'user';
                      updateUserRole(user.id, newRole);
                    }}
                  >
                    Change Role
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="small"
                    icon={<Icon name="ban" size={16} color={theme.danger} />}
                    onPress={() => {
                      const newStatus = user.status === 'active' ? 'banned' : 'active';
                      updateUserStatus(user.id, newStatus);
                    }}
                  >
                    {user.status === 'active' ? 'Ban User' : 'Unban User'}
                  </Button>
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
  filterRow: {
    gap: tokens.spacing.sm,
  },
  roleFilters: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  statusFilters: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  usersCard: {
    gap: tokens.spacing.sm,
  },
  usersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCard: {
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#00000005',
    gap: tokens.spacing.sm,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userBadges: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  userActions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
});
