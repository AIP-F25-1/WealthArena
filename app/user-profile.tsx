import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, TextInput, Icon, FoxMascot, tokens } from '@/src/design-system';

export default function UserProfileScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const [firstName, setFirstName] = useState('Wealthman');
  const [lastName, setLastName] = useState('Trader');
  const [username, setUsername] = useState('Wealthman64360');
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  const isDarkMode = mode === 'dark';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <Card style={styles.profileCard} elevation="med">
          <FoxMascot variant="neutral" size={120} />
          <Button variant="secondary" size="small">
            Change Avatar
          </Button>
        </Card>

        {/* Personal Info */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="agent" size={24} color={theme.primary} />
            <Text variant="h3" weight="semibold">Personal Information</Text>
          </View>

          <TextInput
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
          />

          <TextInput
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
          />

          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
          />
        </Card>

        {/* Preferences */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="settings" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">Preferences</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Icon name="settings" size={20} color={theme.text} />
              <View style={styles.settingText}>
                <Text variant="body" weight="semibold">Dark Mode</Text>
                <Text variant="small" muted>Toggle theme appearance</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={() => setMode(isDarkMode ? 'light' : 'dark')}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="volume-high" size={20} color={theme.text} />
              <View style={styles.settingText}>
                <Text variant="body" weight="semibold">Sound Effects</Text>
                <Text variant="small" muted>Play sounds for actions</Text>
              </View>
            </View>
            <Switch
              value={soundEffects}
              onValueChange={setSoundEffects}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.text} />
              <View style={styles.settingText}>
                <Text variant="body" weight="semibold">Haptic Feedback</Text>
                <Text variant="small" muted>Vibrate on interactions</Text>
              </View>
            </View>
            <Switch
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Save Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          onPress={() => router.back()}
          icon={<Icon name="check-shield" size={20} color={theme.bg} />}
        >
          Save Changes
        </Button>

        {/* Danger Zone */}
        <Card style={styles.dangerCard}>
          <Text variant="body" weight="semibold" color={theme.danger}>
            Danger Zone
          </Text>
          <Button
            variant="danger"
            size="medium"
            fullWidth
            icon={<Ionicons name="trash-outline" size={18} color={theme.bg} />}
          >
            Delete Account
          </Button>
        </Card>

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
    gap: tokens.spacing.md,
  },
  profileCard: {
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  sectionCard: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  dangerCard: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
  },
});
