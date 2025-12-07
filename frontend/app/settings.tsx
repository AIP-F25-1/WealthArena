import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import FloatingChatbot from '../components/FloatingChatbot';

interface UserSettings {
  notifications: {
    push_enabled: boolean;
    email_enabled: boolean;
    signal_alerts: boolean;
    price_alerts: boolean;
    news_alerts: boolean;
  };
  trading: {
    risk_tolerance: 'low' | 'medium' | 'high';
    max_position_size: number;
    stop_loss_enabled: boolean;
    take_profit_enabled: boolean;
  };
  privacy: {
    profile_public: boolean;
    show_portfolio: boolean;
    show_achievements: boolean;
  };
  preferences: {
    theme: 'dark' | 'light' | 'auto';
    language: string;
    currency: string;
    timezone: string;
  };
}

const Settings = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'notifications' | 'trading' | 'privacy' | 'preferences'>('notifications');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Mock settings data
      const mockSettings: UserSettings = {
        notifications: {
          push_enabled: true,
          email_enabled: true,
          signal_alerts: true,
          price_alerts: false,
          news_alerts: true,
        },
        trading: {
          risk_tolerance: 'medium',
          max_position_size: 0.1,
          stop_loss_enabled: true,
          take_profit_enabled: true,
        },
        privacy: {
          profile_public: true,
          show_portfolio: false,
          show_achievements: true,
        },
        preferences: {
          theme: 'dark',
          language: 'en',
          currency: 'USD',
          timezone: 'UTC',
        },
      };

      setSettings(mockSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (section: keyof UserSettings, key: string, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value,
      },
    });
  };

  const saveSettings = async () => {
    try {
      // Here you would save to backend
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const resetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: loadSettings },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E1B4B', '#312E81']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveSettings}
          >
            <Ionicons name="checkmark" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Section Navigation */}
        <View style={styles.sectionNav}>
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'notifications' && styles.activeSectionTab]}
            onPress={() => setActiveSection('notifications')}
          >
            <Ionicons name="notifications" size={20} color={activeSection === 'notifications' ? '#6366F1' : '#A1A1AA'} />
            <Text style={[styles.sectionTabText, activeSection === 'notifications' && styles.activeSectionTabText]}>
              Notifications
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'trading' && styles.activeSectionTab]}
            onPress={() => setActiveSection('trading')}
          >
            <Ionicons name="trending-up" size={20} color={activeSection === 'trading' ? '#6366F1' : '#A1A1AA'} />
            <Text style={[styles.sectionTabText, activeSection === 'trading' && styles.activeSectionTabText]}>
              Trading
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'privacy' && styles.activeSectionTab]}
            onPress={() => setActiveSection('privacy')}
          >
            <Ionicons name="shield" size={20} color={activeSection === 'privacy' ? '#6366F1' : '#A1A1AA'} />
            <Text style={[styles.sectionTabText, activeSection === 'privacy' && styles.activeSectionTabText]}>
              Privacy
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'preferences' && styles.activeSectionTab]}
            onPress={() => setActiveSection('preferences')}
          >
            <Ionicons name="settings" size={20} color={activeSection === 'preferences' ? '#6366F1' : '#A1A1AA'} />
            <Text style={[styles.sectionTabText, activeSection === 'preferences' && styles.activeSectionTabText]}>
              Preferences
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Content */}
        {activeSection === 'notifications' && settings && (
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Notification Settings</Text>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>General</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingDescription}>Receive push notifications on your device</Text>
                </View>
                <Switch
                  value={settings.notifications.push_enabled}
                  onValueChange={(value) => updateSetting('notifications', 'push_enabled', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.notifications.push_enabled ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>Receive notifications via email</Text>
                </View>
                <Switch
                  value={settings.notifications.email_enabled}
                  onValueChange={(value) => updateSetting('notifications', 'email_enabled', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.notifications.email_enabled ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Trading Alerts</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Signal Alerts</Text>
                  <Text style={styles.settingDescription}>Get notified about new trading signals</Text>
                </View>
                <Switch
                  value={settings.notifications.signal_alerts}
                  onValueChange={(value) => updateSetting('notifications', 'signal_alerts', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.notifications.signal_alerts ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Price Alerts</Text>
                  <Text style={styles.settingDescription}>Get notified when prices hit your targets</Text>
                </View>
                <Switch
                  value={settings.notifications.price_alerts}
                  onValueChange={(value) => updateSetting('notifications', 'price_alerts', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.notifications.price_alerts ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>News Alerts</Text>
                  <Text style={styles.settingDescription}>Get notified about market news</Text>
                </View>
                <Switch
                  value={settings.notifications.news_alerts}
                  onValueChange={(value) => updateSetting('notifications', 'news_alerts', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.notifications.news_alerts ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
            </View>
          </View>
        )}

        {activeSection === 'trading' && settings && (
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Trading Settings</Text>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Risk Management</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Risk Tolerance</Text>
                  <Text style={styles.settingDescription}>Your preferred risk level</Text>
                </View>
                <View style={styles.riskSelector}>
                  {['low', 'medium', 'high'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.riskOption,
                        settings.trading.risk_tolerance === level && styles.riskOptionSelected
                      ]}
                      onPress={() => updateSetting('trading', 'risk_tolerance', level)}
                    >
                      <Text style={[
                        styles.riskOptionText,
                        settings.trading.risk_tolerance === level && styles.riskOptionTextSelected
                      ]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Max Position Size</Text>
                  <Text style={styles.settingDescription}>Maximum percentage of portfolio per trade</Text>
                </View>
                <Text style={styles.settingValue}>
                  {(settings.trading.max_position_size * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Trade Protection</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Stop Loss</Text>
                  <Text style={styles.settingDescription}>Automatically set stop loss orders</Text>
                </View>
                <Switch
                  value={settings.trading.stop_loss_enabled}
                  onValueChange={(value) => updateSetting('trading', 'stop_loss_enabled', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.trading.stop_loss_enabled ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Take Profit</Text>
                  <Text style={styles.settingDescription}>Automatically set take profit orders</Text>
                </View>
                <Switch
                  value={settings.trading.take_profit_enabled}
                  onValueChange={(value) => updateSetting('trading', 'take_profit_enabled', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.trading.take_profit_enabled ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
            </View>
          </View>
        )}

        {activeSection === 'privacy' && settings && (
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Profile Visibility</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Public Profile</Text>
                  <Text style={styles.settingDescription}>Make your profile visible to other users</Text>
                </View>
                <Switch
                  value={settings.privacy.profile_public}
                  onValueChange={(value) => updateSetting('privacy', 'profile_public', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.privacy.profile_public ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Portfolio</Text>
                  <Text style={styles.settingDescription}>Display your portfolio value publicly</Text>
                </View>
                <Switch
                  value={settings.privacy.show_portfolio}
                  onValueChange={(value) => updateSetting('privacy', 'show_portfolio', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.privacy.show_portfolio ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Achievements</Text>
                  <Text style={styles.settingDescription}>Display your achievements and badges</Text>
                </View>
                <Switch
                  value={settings.privacy.show_achievements}
                  onValueChange={(value) => updateSetting('privacy', 'show_achievements', value)}
                  trackColor={{ false: '#2A2A3E', true: '#6366F1' }}
                  thumbColor={settings.privacy.show_achievements ? '#FFFFFF' : '#A1A1AA'}
                />
              </View>
            </View>
          </View>
        )}

        {activeSection === 'preferences' && settings && (
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>App Preferences</Text>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Display</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Theme</Text>
                  <Text style={styles.settingDescription}>Choose your preferred theme</Text>
                </View>
                <View style={styles.themeSelector}>
                  {['dark', 'light', 'auto'].map((theme) => (
                    <TouchableOpacity
                      key={theme}
                      style={[
                        styles.themeOption,
                        settings.preferences.theme === theme && styles.themeOptionSelected
                      ]}
                      onPress={() => updateSetting('preferences', 'theme', theme)}
                    >
                      <Text style={[
                        styles.themeOptionText,
                        settings.preferences.theme === theme && styles.themeOptionTextSelected
                      ]}>
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Localization</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Language</Text>
                  <Text style={styles.settingDescription}>App language</Text>
                </View>
                <Text style={styles.settingValue}>English</Text>
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Currency</Text>
                  <Text style={styles.settingDescription}>Display currency</Text>
                </View>
                <Text style={styles.settingValue}>{settings.preferences.currency}</Text>
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Timezone</Text>
                  <Text style={styles.settingDescription}>Your timezone</Text>
                </View>
                <Text style={styles.settingValue}>{settings.preferences.timezone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetSettings}
          >
            <Ionicons name="refresh" size={20} color="#A1A1AA" />
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.saveAllButton}
            onPress={saveSettings}
          >
            <Ionicons name="save" size={20} color="white" />
            <Text style={styles.saveAllButtonText}>Save All Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FloatingChatbot
        context={{
          current_page: 'settings',
          active_section: activeSection,
          settings: settings,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F23',
  },
  loadingText: {
    color: '#A1A1AA',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionNav: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeSectionTab: {
    backgroundColor: '#6366F1',
  },
  sectionTabText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: 'bold',
  },
  activeSectionTabText: {
    color: 'white',
  },
  sectionContent: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingGroupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#A1A1AA',
  },
  settingValue: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  riskSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  riskOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
  },
  riskOptionSelected: {
    backgroundColor: '#6366F1',
  },
  riskOptionText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  riskOptionTextSelected: {
    color: 'white',
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A3E',
  },
  themeOptionSelected: {
    backgroundColor: '#6366F1',
  },
  themeOptionText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  themeOptionTextSelected: {
    color: 'white',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    gap: 8,
  },
  resetButtonText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    gap: 8,
  },
  saveAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Settings;
