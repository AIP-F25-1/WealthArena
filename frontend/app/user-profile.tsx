import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, TextInput, Icon, FAB, Badge, tokens } from '@/src/design-system';
import { useUser } from '@/contexts/UserContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { updateUserProfile } from '@/services/apiService';
import UserAvatar from '@/components/UserAvatar';
import AvatarSelector from '@/components/AvatarSelector';

export default function UserProfileScreen() {
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const { user, updateUser } = useUser();
  const { settings } = useUserSettings();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  const isDarkMode = mode === 'dark';

  // Load user data on mount
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSave = async () => {
    // Validate
    if (!firstName.trim()) {
      Alert.alert('Error', 'First name is required');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    setIsSaving(true);
    try {
      // Build profile update payload - preserve avatar if it was changed
      const profileData: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        bio: bio.trim() || undefined,
      };
      
      // Only include avatar fields if they exist (preserve current avatar if not changed)
      if (user?.avatar_type) {
        profileData.avatar_type = user.avatar_type;
      }
      if (user?.avatar_variant) {
        profileData.avatar_variant = user.avatar_variant;
      }
      if (user?.avatar_url) {
        profileData.avatarUrl = user.avatar_url;
      }
      
      const res = await updateUserProfile(profileData);

      if (!res.success || !res.data) {
        Alert.alert('Error', res.message || 'Failed to update profile. Please try again.');
        return;
      }

      // Update local user context using response.data
      updateUser({
        firstName: res.data.firstName,
        lastName: res.data.lastName,
        username: res.data.username,
        full_name: res.data.full_name,
        bio: res.data.bio,
        avatar_type: res.data.avatar_type,
        avatar_variant: res.data.avatar_variant,
        avatar_url: res.data.avatar_url,
      });

      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSelect = async (avatar: { type: 'mascot'; variant: any } | { type: 'custom'; url: string }) => {
    setIsSaving(true);
    try {
      const res = await updateUserProfile({
        avatar_type: avatar.type,
        avatar_variant: avatar.type === 'mascot' ? avatar.variant : undefined,
        avatarUrl: avatar.type === 'custom' ? avatar.url : undefined,
      });

      if (!res.success || !res.data) {
        Alert.alert('Error', res.message || 'Failed to update avatar. Please try again.');
        return;
      }

      // Update local context using response.data
      updateUser({
        avatar_type: res.data.avatar_type || avatar.type,
        avatar_variant: res.data.avatar_variant || (avatar.type === 'mascot' ? avatar.variant : undefined),
        avatar_url: res.data.avatar_url || (avatar.type === 'custom' ? avatar.url : undefined),
      });

      Alert.alert('Success', 'Avatar updated successfully!');
      setShowAvatarSelector(false);
    } catch (error: any) {
      console.error('Avatar update error:', error);
      Alert.alert('Error', error.message || 'Failed to update avatar');
    } finally {
      setIsSaving(false);
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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <Card style={styles.profileCard} elevation="med">
          <UserAvatar user={user} size={120} />
          <Button 
            variant="secondary" 
            size="small"
            onPress={() => setShowAvatarSelector(true)}
          >
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

          <TextInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself"
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Risk Profile */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="shield" size={24} color={theme.primary} />
            <Text variant="h3" weight="semibold">Risk Profile</Text>
          </View>

          <View style={styles.riskProfileSummary}>
            <View style={styles.riskLevelDisplay}>
              <Badge 
                variant={settings.riskProfile.riskTolerance === 'conservative' ? 'success' : 
                        settings.riskProfile.riskTolerance === 'moderate' ? 'warning' : 'danger'}
                size="large"
              >
                {settings.riskProfile.riskTolerance.replace('_', ' ')}
              </Badge>
              <Text variant="body" weight="semibold">
                Risk Tolerance: {settings.riskProfile.riskTolerance.replace('_', ' ')}
              </Text>
            </View>
            
            <View style={styles.riskDetails}>
              <View style={styles.riskDetail}>
                <Text variant="small" muted>Investment Horizon</Text>
                <Text variant="body" weight="semibold">
                  {settings.riskProfile.investmentHorizon}-term
                </Text>
              </View>
              <View style={styles.riskDetail}>
                <Text variant="small" muted>Max Drawdown</Text>
                <Text variant="body" weight="semibold">
                  {settings.riskProfile.maxDrawdown}%
                </Text>
              </View>
            </View>
          </View>

          <Button
            variant="secondary"
            size="medium"
            onPress={() => router.push('/risk-assessment')}
            icon={<Icon name="shield" size={18} color={theme.primary} />}
            fullWidth
          >
            Update Risk Assessment
          </Button>
        </Card>

        {/* Personalized Recommendations */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="sparkles" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">AI Recommendations</Text>
          </View>

          <Text variant="body" muted style={styles.sectionDescription}>
            Get personalized portfolio and strategy recommendations based on your risk profile
          </Text>

          <Button
            variant="primary"
            size="medium"
            onPress={() => router.push('/personalized-recommendations')}
            icon={<Icon name="sparkles" size={18} color={theme.bg} />}
            fullWidth
          >
            View Recommendations
          </Button>

          {settings.personalizedRecommendations.lastUpdated && (
            <Text variant="xs" muted center style={styles.lastUpdated}>
              Last updated: {new Date(settings.personalizedRecommendations.lastUpdated).toLocaleDateString()}
            </Text>
          )}
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
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving}
          icon={!isSaving ? <Icon name="check-shield" size={20} color={theme.bg} /> : undefined}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
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
      
      <FAB onPress={() => router.push('/ai-chat')} />
      
      {/* Avatar Selector Modal */}
      <AvatarSelector
        visible={showAvatarSelector}
        onClose={() => !isSaving && setShowAvatarSelector(false)}
        onSelect={handleAvatarSelect}
        currentAvatar={user?.avatar_type === 'mascot' 
          ? { type: 'mascot', variant: user.avatar_variant || 'neutral' }
          : user?.avatar_type === 'custom' && user.avatar_url
          ? { type: 'custom', url: user.avatar_url }
          : undefined
        }
      />
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
  riskProfileSummary: {
    gap: tokens.spacing.md,
  },
  riskLevelDisplay: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  riskDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: tokens.radius.sm,
  },
  riskDetail: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  sectionDescription: {
    marginBottom: tokens.spacing.md,
    lineHeight: 20,
  },
  lastUpdated: {
    marginTop: tokens.spacing.sm,
  },
});
