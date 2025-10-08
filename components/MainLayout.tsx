import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Modal,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import {
  Menu,
  Bell,
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  Bot,
  Settings,
  LogOut,
  Home,
  CheckSquare,
  Gamepad2,
  MessageCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  currentPage?: string;
  showSidebar?: boolean;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onMenuPress?: () => void;
  onNavigate?: (page: string) => void;
}

interface AssetFilter {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  route: string;
}

const ASSET_FILTERS: AssetFilter[] = [
  { id: 'stocks', name: 'Stocks', icon: '📈', enabled: true },
  { id: 'forex', name: 'Currency Pairs', icon: '💱', enabled: true },
  { id: 'commodities', name: 'Commodities', icon: '🥇', enabled: true },
  { id: 'crypto', name: 'Crypto', icon: '₿', enabled: true },
  { id: 'etfs', name: 'ETFs', icon: '📊', enabled: true },
];

const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, route: 'dashboard' },
  { id: 'opportunities', name: 'Opportunities', icon: CheckSquare, route: 'opportunities' },
  { id: 'game', name: 'Game', icon: Gamepad2, route: 'game' },
  { id: 'chat', name: 'Chat', icon: MessageCircle, route: 'chat' },
];

export default function MainLayout({
  children,
  title,
  currentPage = 'dashboard',
  showSidebar = true,
  onNotificationPress,
  onProfilePress,
  onMenuPress,
  onNavigate,
}: MainLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [assetFilters, setAssetFilters] = useState<AssetFilter[]>(ASSET_FILTERS);

  const toggleAssetFilter = (id: string) => {
    setAssetFilters(prev =>
      prev.map(filter =>
        filter.id === id ? { ...filter, enabled: !filter.enabled } : filter
      )
    );
  };

  const handleNavigation = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };


  const SidebarContent = () => (
    <View style={styles.sidebar}>
      <LinearGradient
        colors={[Colors.backgroundGradientStart, Colors.backgroundGradientEnd]}
        style={styles.sidebarGradient}
      >
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>WealthArena</Text>
          <TouchableOpacity
            style={styles.sidebarCloseButton}
            onPress={() => setSidebarVisible(false)}
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsSection}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Portfolio Value</Text>
              <Text style={styles.statValue}>$125,430.50</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Today's P&L</Text>
              <View style={styles.statRowRight}>
                <TrendingUp size={16} color={Colors.neonGreen} />
                <Text style={[styles.statValue, { color: Colors.neonGreen }]}>+$842.30</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Active Trades</Text>
              <Text style={styles.statValue}>8 positions</Text>
            </View>
          </View>
        </View>

        {/* Asset Class Filter */}
        <View style={styles.assetFilterSection}>
          <Text style={styles.sectionTitle}>Asset Class Filter</Text>
          <View style={styles.filterContainer}>
            {assetFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterItem,
                  filter.enabled && styles.filterItemEnabled,
                ]}
                onPress={() => toggleAssetFilter(filter.id)}
              >
                <Text style={styles.filterIcon}>{filter.icon}</Text>
                <Text style={[
                  styles.filterText,
                  filter.enabled && styles.filterTextEnabled,
                ]}>
                  {filter.name}
                </Text>
                {filter.enabled && (
                  <Text style={styles.filterCheckmark}>☑</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chatbot Quick Access */}
        <View style={styles.chatbotSection}>
          <Text style={styles.sectionTitle}>AI Assistant</Text>
          <TouchableOpacity style={styles.chatbotButton}>
            <LinearGradient
              colors={[Colors.secondary, Colors.accent]}
              style={styles.chatbotGradient}
            >
              <Bot size={20} color={Colors.primary} />
              <Text style={styles.chatbotText}>Chat with AI</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Sidebar Footer */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity style={styles.sidebarAction}>
            <Settings size={18} color={Colors.textMuted} />
            <Text style={styles.sidebarActionText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarAction}>
            <LogOut size={18} color={Colors.textMuted} />
            <Text style={styles.sidebarActionText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <LinearGradient
          colors={[Colors.surface, Colors.primaryLight]}
          style={styles.topNavGradient}
        >
          <View style={styles.topNavContent}>
            {/* Left: Logo and Menu */}
            <View style={styles.navLeft}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setSidebarVisible(true)}
              >
                <Menu size={24} color={Colors.neonCyan} />
              </TouchableOpacity>
              <Text style={styles.logo}>WealthArena</Text>
            </View>

            {/* Center: Menu Items */}
            <View style={styles.navCenter}>
              {NAVIGATION_ITEMS.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => handleNavigation(item.route)}
                  >
                    <IconComponent size={18} color={isActive ? Colors.neonCyan : Colors.text} />
                    <Text style={[
                      styles.navItemText,
                      isActive && styles.navItemTextActive
                    ]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Right: Asset Type Selector, Notifications and Chat */}
            <View style={styles.navRight}>
              {/* Asset Type Selector (Global) */}
              <TouchableOpacity style={styles.assetSelector}>
                <Text style={styles.assetSelectorText}>📈 Stocks</Text>
                <ChevronDown size={16} color={Colors.neonCyan} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.notificationButton} onPress={onNotificationPress}>
                <Bell size={20} color={Colors.neonCyan} />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.chatButton} onPress={() => router.push('/(tabs)/chat')}>
                <MessageCircle size={20} color={Colors.neonCyan} />
                <View style={styles.chatNotificationDot} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{title}</Text>
          <View style={styles.pageHeaderActions}>
            <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleTimeString()}</Text>
            <View style={styles.marketStatus}>
              <View style={styles.marketStatusDot} />
              <Text style={styles.marketStatusText}>Market Open</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {children}
        </ScrollView>
      </View>

      {/* Sidebar Modal */}
      <Modal
        visible={sidebarVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSidebarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSidebarVisible(false)}
          />
          <View style={styles.sidebarContainer}>
            <SidebarContent />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topNav: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topNavGradient: {
    flex: 1,
  },
  topNavContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: Colors.text,
    textShadowColor: Colors.neonCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    letterSpacing: 1,
  },
  navCenter: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: Colors.glow.cyan,
    borderWidth: 2,
    borderColor: Colors.neonCyan,
    shadowColor: Colors.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  navItemTextActive: {
    color: Colors.neonCyan,
    textShadowColor: Colors.neonCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  assetSelectorText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  chatButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  chatNotificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.neonGreen,
    shadowColor: Colors.neonGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  mainContent: {
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: Colors.text,
    textShadowColor: Colors.neonCyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 0.5,
  },
  pageHeaderActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  marketStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marketStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.neonGreen,
  },
  marketStatusText: {
    fontSize: 12,
    color: Colors.neonGreen,
    fontWeight: '600' as const,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  
  // Sidebar styles
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    width: width * 0.8,
    maxWidth: 320,
  },
  sidebar: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  sidebarGradient: {
    flex: 1,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sidebarCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  assetFilterSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterContainer: {
    gap: 8,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  filterItemEnabled: {
    backgroundColor: Colors.glow.cyan,
    borderWidth: 1,
    borderColor: Colors.neonCyan,
  },
  filterIcon: {
    fontSize: 16,
  },
  filterText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  filterTextEnabled: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  filterCheckmark: {
    fontSize: 14,
    color: Colors.neonCyan,
  },
  chatbotSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chatbotButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chatbotGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  chatbotText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  sidebarFooter: {
    padding: 20,
    gap: 12,
  },
  sidebarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sidebarActionText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
