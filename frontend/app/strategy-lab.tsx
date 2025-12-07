import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  Modal, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  TextInput, 
  Icon, 
  Badge,
  FAB,
  tokens 
} from '@/src/design-system';
import { apiService } from '@/services/apiService';

interface Strategy {
  id: string;
  name: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high';
  expected_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  is_active: boolean;
}

interface TradingSignal {
  id: string;
  symbol: string;
  signal_type: 'BUY' | 'SELL';
  confidence_score: number;
  entry_price: number;
}

export default function StrategyLabScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    description: '',
    risk_level: 'medium' as 'low' | 'medium' | 'high',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load trading signals
      try {
        const signalsResponse = await apiService.getTopSignals();
        if (signalsResponse.success && signalsResponse.data) {
          const signalsData = Array.isArray(signalsResponse.data) 
            ? signalsResponse.data 
            : signalsResponse.data.signals || [];
          setSignals(signalsData.slice(0, 5));
        }
      } catch (error) {
        console.warn('Failed to load signals:', error);
      }

      // Load user strategies (mock data for now - will be replaced with backend API)
      const mockStrategies: Strategy[] = [
        {
          id: '1',
          name: 'Conservative Growth',
          description: 'Low-risk strategy focusing on blue-chip stocks with steady dividends',
          risk_level: 'low',
          expected_return: 0.08,
          max_drawdown: 0.05,
          sharpe_ratio: 1.2,
          is_active: true,
        },
        {
          id: '2',
          name: 'Aggressive Growth',
          description: 'High-risk strategy targeting high-growth stocks and emerging markets',
          risk_level: 'high',
          expected_return: 0.15,
          max_drawdown: 0.20,
          sharpe_ratio: 0.8,
          is_active: false,
        },
        {
          id: '3',
          name: 'Balanced Portfolio',
          description: 'Moderate risk strategy with diversified asset allocation',
          risk_level: 'medium',
          expected_return: 0.12,
          max_drawdown: 0.10,
          sharpe_ratio: 1.0,
          is_active: true,
        },
      ];
      
      setStrategies(mockStrategies);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load strategy data');
    } finally {
      setLoading(false);
    }
  };

  const createStrategy = () => {
    if (!newStrategy.name.trim()) {
      Alert.alert('Error', 'Please enter a strategy name');
      return;
    }

    const strategy: Strategy = {
      id: Date.now().toString(),
      name: newStrategy.name,
      description: newStrategy.description,
      risk_level: newStrategy.risk_level,
      expected_return: 0.10,
      max_drawdown: 0.08,
      sharpe_ratio: 1.0,
      is_active: false,
    };

    setStrategies([...strategies, strategy]);
    setNewStrategy({ name: '', description: '', risk_level: 'medium' });
    setShowCreateForm(false);
    Alert.alert('Success', 'Strategy created successfully');
  };

  const toggleStrategy = (strategyId: string) => {
    setStrategies(strategies.map(strategy => 
      strategy.id === strategyId 
        ? { ...strategy, is_active: !strategy.is_active }
        : strategy
    ));
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return theme.success;
      case 'medium': return theme.warning;
      case 'high': return theme.danger;
      default: return theme.muted;
    }
  };

  const getRiskLabel = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'Low Risk';
      case 'medium': return 'Medium Risk';
      case 'high': return 'High Risk';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Icon name="lab" size={48} color={theme.primary} />
          <Text variant="h3" weight="semibold" style={{ marginTop: tokens.spacing.md }}>
            Loading Strategy Lab...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Strategy Lab</Text>
        <Pressable onPress={() => setShowCreateForm(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Signals Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="signal" size={24} color={theme.primary} />
            <Text variant="h3" weight="semibold">AI Trading Signals</Text>
          </View>
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Latest signals from our RL models
          </Text>
          
          {signals.length > 0 ? (
            <View style={styles.signalsContainer}>
              {signals.map((signal) => (
                <Card key={signal.id} style={styles.signalCard}>
                  <View style={styles.signalHeader}>
                    <View style={styles.signalLeft}>
                      <View style={[styles.symbolCircle, { backgroundColor: theme.primary + '20' }]}>
                        <Text variant="body" weight="bold">{signal.symbol.slice(0, 1)}</Text>
                      </View>
                      <View>
                        <Text variant="body" weight="semibold">{signal.symbol}</Text>
                        <Text variant="small" muted>
                          Entry: ${signal.entry_price.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <Badge 
                      variant={signal.signal_type === 'BUY' ? 'success' : 'danger'} 
                      size="small"
                    >
                      {signal.signal_type}
                    </Badge>
                  </View>
                  <View style={styles.signalFooter}>
                    <Text variant="small" muted>
                      Confidence: {(signal.confidence_score * 100).toFixed(1)}%
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="signal" size={48} color={theme.muted} />
              <Text variant="body" muted center>No signals available</Text>
            </View>
          )}
        </Card>

        {/* User Strategies Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="portfolio" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">Your Strategies</Text>
          </View>
          <Text variant="small" muted style={styles.sectionSubtitle}>
            Create and manage your trading strategies
          </Text>
          
          {strategies.map((strategy) => (
            <Card key={strategy.id} style={styles.strategyCard}>
              <View style={styles.strategyHeader}>
                <View style={styles.strategyLeft}>
                  <Text variant="h4" weight="semibold">{strategy.name}</Text>
                  <Text variant="small" muted>{strategy.description}</Text>
                </View>
                <Pressable
                  onPress={() => toggleStrategy(strategy.id)}
                  style={[
                    styles.toggleButton,
                    { 
                      backgroundColor: strategy.is_active ? theme.success : theme.border 
                    }
                  ]}
                >
                  <Text 
                    variant="small" 
                    weight="semibold"
                    color={strategy.is_active ? theme.bg : theme.text}
                  >
                    {strategy.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </Pressable>
              </View>
              
              <View style={styles.strategyMetrics}>
                <View style={styles.metric}>
                  <Text variant="xs" muted>Risk Level</Text>
                  <Text variant="small" weight="semibold" color={getRiskColor(strategy.risk_level)}>
                    {getRiskLabel(strategy.risk_level)}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text variant="xs" muted>Expected Return</Text>
                  <Text variant="small" weight="semibold">
                    {(strategy.expected_return * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text variant="xs" muted>Sharpe Ratio</Text>
                  <Text variant="small" weight="semibold">
                    {strategy.sharpe_ratio.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </Card>

        {/* Bottom Spacing */}
        <View style={{ height: tokens.spacing.xl }} />
      </ScrollView>

      <FAB onPress={() => router.push('/ai-chat')} />

      {/* Create Strategy Modal */}
      <Modal
        visible={showCreateForm}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowCreateForm(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContainer}>
                <Card style={styles.modalContent}>
                  <ScrollView 
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.modalHeader}>
                      <Text variant="h3" weight="semibold">Create New Strategy</Text>
                      <Pressable 
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowCreateForm(false);
                        }}
                      >
                        <Ionicons name="close" size={24} color={theme.text} />
                      </Pressable>
                    </View>
                    
                    <TextInput
                      label="Strategy Name"
                      value={newStrategy.name}
                      onChangeText={(text) => setNewStrategy({ ...newStrategy, name: text })}
                      placeholder="Enter strategy name"
                      autoFocus={false}
                      returnKeyType="next"
                      onSubmitEditing={() => {
                        // Focus next input if needed
                      }}
                    />
                    
                    <TextInput
                      label="Description"
                      value={newStrategy.description}
                      onChangeText={(text) => setNewStrategy({ ...newStrategy, description: text })}
                      placeholder="Describe your strategy"
                      multiline
                      numberOfLines={3}
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                    
                    <View style={styles.riskSelector}>
                      <Text variant="body" weight="semibold" style={styles.riskLabel}>Risk Level:</Text>
                      <View style={styles.riskOptions}>
                        {(['low', 'medium', 'high'] as const).map((level) => (
                          <Pressable
                            key={level}
                            onPress={() => {
                              Keyboard.dismiss();
                              setNewStrategy({ ...newStrategy, risk_level: level });
                            }}
                            style={[
                              styles.riskOption,
                              { borderColor: theme.border },
                              newStrategy.risk_level === level && { 
                                backgroundColor: theme.primary,
                                borderColor: theme.primary 
                              }
                            ]}
                          >
                            <Text 
                              variant="small" 
                              weight="semibold"
                              color={newStrategy.risk_level === level ? theme.bg : theme.text}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.modalButtons}>
                      <Button
                        variant="ghost"
                        size="large"
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowCreateForm(false);
                        }}
                        style={styles.modalButton}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="large"
                        onPress={() => {
                          Keyboard.dismiss();
                          createStrategy();
                        }}
                        style={styles.modalButton}
                      >
                        Create
                      </Button>
                    </View>
                  </ScrollView>
                </Card>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
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
  addButton: {
    padding: tokens.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    gap: tokens.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  sectionSubtitle: {
    marginTop: tokens.spacing.xs,
  },
  signalsContainer: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  signalCard: {
    gap: tokens.spacing.xs,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  symbolCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalFooter: {
    marginTop: tokens.spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.sm,
  },
  strategyCard: {
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  strategyLeft: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  toggleButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.md,
  },
  strategyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  metric: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskSelector: {
    gap: tokens.spacing.sm,
  },
  riskLabel: {
    marginBottom: tokens.spacing.xs,
  },
  riskOptions: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  riskOption: {
    flex: 1,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
