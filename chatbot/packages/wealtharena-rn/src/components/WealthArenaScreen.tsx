/**
 * WealthArena React Native Screen Component
 * Main drop-in component with black/neon-green theme
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { WealthArenaClient, ChatResponse, AnalyzeResponse, StateResponse, TradeResponse } from '@wealtharena/mobile-sdk-rn';
import { WealthArenaTheme, defaultTheme } from '../theme';

const { width } = Dimensions.get('window');

export interface WealthArenaScreenProps {
  client: WealthArenaClient;
  theme?: Partial<WealthArenaTheme>;
  onEvent?: (event: { type: string; data: any }) => void;
}

type TabType = 'learn' | 'analyze' | 'trade' | 'chat';

export const WealthArenaScreen: React.FC<WealthArenaScreenProps> = ({
  client,
  theme = {},
  onEvent,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('learn');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<StateResponse | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatResponse[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [tradeSymbol, setTradeSymbol] = useState('AAPL');
  const [tradeQuantity, setTradeQuantity] = useState('1');
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');

  const mergedTheme = { ...defaultTheme, ...theme };

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      setLoading(true);
      const stateData = await client.state();
      setState(stateData);
    } catch (error) {
      console.error('Failed to load state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;

    try {
      setLoading(true);
      const response = await client.chat({
        message: chatInput,
        symbol: tradeSymbol,
      });

      setChatMessages(prev => [...prev, response]);
      setChatInput('');
      
      onEvent?.({ type: 'ChatMessage', data: response });
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const response = await client.analyze({ symbol: tradeSymbol });
      setAnalysis(response);
      onEvent?.({ type: 'AnalysisGenerated', data: response });
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze symbol');
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrade = async () => {
    const quantity = parseFloat(tradeQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Invalid quantity');
      return;
    }

    try {
      setLoading(true);
      const response = await client.paperTrade({
        action: tradeAction,
        symbol: tradeSymbol,
        quantity,
      });

      if (response.success) {
        Alert.alert('Success', response.message);
        await loadState();
        onEvent?.({ type: 'TradePlaced', data: response });
      } else {
        Alert.alert('Error', response.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute trade');
      console.error('Trade error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTabButton = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity
      key={tab}
      style={[
        styles.tabButton,
        activeTab === tab && styles.activeTabButton,
        { borderColor: mergedTheme.colors.primary }
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.activeTabButtonText,
        { color: activeTab === tab ? mergedTheme.colors.primary : mergedTheme.colors.textSecondary }
      ]}>
        {icon} {label}
      </Text>
    </TouchableOpacity>
  );

  const renderLearnTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={[styles.card, { backgroundColor: mergedTheme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: mergedTheme.colors.primary }]}>
          📚 Trading Basics
        </Text>
        <Text style={[styles.cardText, { color: mergedTheme.colors.text }]}>
          Learn the fundamentals of trading, including key terms and concepts.
        </Text>
        <Text style={[styles.cardSubtext, { color: mergedTheme.colors.textSecondary }]}>
          Topics: Market types, Order types, Risk management
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: mergedTheme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: mergedTheme.colors.primary }]}>
          📊 Technical Indicators
        </Text>
        <Text style={[styles.cardText, { color: mergedTheme.colors.text }]}>
          Understand how to use technical analysis tools.
        </Text>
        <Text style={[styles.cardSubtext, { color: mergedTheme.colors.textSecondary }]}>
          Topics: Moving averages, RSI, Support and resistance
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: mergedTheme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: mergedTheme.colors.primary }]}>
          ⚠️ Risk Management
        </Text>
        <Text style={[styles.cardText, { color: mergedTheme.colors.text }]}>
          Learn how to protect your capital and manage risk.
        </Text>
        <Text style={[styles.cardSubtext, { color: mergedTheme.colors.textSecondary }]}>
          Topics: Position sizing, Stop losses, Diversification
        </Text>
      </View>
    </ScrollView>
  );

  const renderAnalyzeTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={[styles.card, { backgroundColor: mergedTheme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: mergedTheme.colors.primary }]}>
          📈 Technical Analysis
        </Text>
        
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: mergedTheme.colors.background,
                color: mergedTheme.colors.text,
                borderColor: mergedTheme.colors.border
              }
            ]}
            value={tradeSymbol}
            onChangeText={setTradeSymbol}
            placeholder="Symbol (e.g., AAPL)"
            placeholderTextColor={mergedTheme.colors.textSecondary}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: mergedTheme.colors.primary }]}
            onPress={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={mergedTheme.colors.background} />
            ) : (
              <Text style={[styles.buttonText, { color: mergedTheme.colors.background }]}>
                Analyze
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {analysis && (
          <View style={styles.analysisResults}>
            <Text style={[styles.analysisTitle, { color: mergedTheme.colors.text }]}>
              {analysis.symbol} - ${analysis.current_price.toFixed(2)}
            </Text>
            
            {analysis.signals.map((signal, index) => (
              <View key={index} style={styles.signal}>
                <Text style={[
                  styles.signalType,
                  { color: signal.type === 'buy' ? mergedTheme.colors.success : mergedTheme.colors.error }
                ]}>
                  {signal.type.toUpperCase()}: {signal.message}
                </Text>
                <Text style={[styles.signalExplanation, { color: mergedTheme.colors.textSecondary }]}>
                  {signal.explanation}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderTradeTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={[styles.card, { backgroundColor: mergedTheme.colors.surface }]}>
        <Text style={[styles.cardTitle, { color: mergedTheme.colors.primary }]}>
          💹 Paper Trading
        </Text>
        
        {state && (
          <View style={styles.balanceInfo}>
            <Text style={[styles.balanceText, { color: mergedTheme.colors.text }]}>
              Balance: ${state.balance.toFixed(2)}
            </Text>
            <Text style={[styles.pnlText, { 
              color: state.total_pnl >= 0 ? mergedTheme.colors.success : mergedTheme.colors.error 
            }]}>
              P&L: ${state.total_pnl.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.tradeForm}>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: mergedTheme.colors.background,
                  color: mergedTheme.colors.text,
                  borderColor: mergedTheme.colors.border
                }
              ]}
              value={tradeSymbol}
              onChangeText={setTradeSymbol}
              placeholder="Symbol"
              placeholderTextColor={mergedTheme.colors.textSecondary}
            />
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: mergedTheme.colors.background,
                  color: mergedTheme.colors.text,
                  borderColor: mergedTheme.colors.border
                }
              ]}
              value={tradeQuantity}
              onChangeText={setTradeQuantity}
              placeholder="Quantity"
              placeholderTextColor={mergedTheme.colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { 
                  backgroundColor: tradeAction === 'buy' ? mergedTheme.colors.success : mergedTheme.colors.surface,
                  borderColor: mergedTheme.colors.success
                }
              ]}
              onPress={() => setTradeAction('buy')}
            >
              <Text style={[
                styles.actionButtonText,
                { color: tradeAction === 'buy' ? mergedTheme.colors.background : mergedTheme.colors.success }
              ]}>
                BUY
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                { 
                  backgroundColor: tradeAction === 'sell' ? mergedTheme.colors.error : mergedTheme.colors.surface,
                  borderColor: mergedTheme.colors.error
                }
              ]}
              onPress={() => setTradeAction('sell')}
            >
              <Text style={[
                styles.actionButtonText,
                { color: tradeAction === 'sell' ? mergedTheme.colors.background : mergedTheme.colors.error }
              ]}>
                SELL
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: mergedTheme.colors.primary }]}
            onPress={handleTrade}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={mergedTheme.colors.background} />
            ) : (
              <Text style={[styles.buttonText, { color: mergedTheme.colors.background }]}>
                Execute Trade
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderChatTab = () => (
    <View style={styles.tabContent}>
      <ScrollView style={styles.chatContainer}>
        {chatMessages.map((message, index) => (
          <View key={index} style={styles.chatMessage}>
            <Text style={[styles.chatReply, { color: mergedTheme.colors.text }]}>
              {message.reply}
            </Text>
            {message.sources.length > 0 && (
              <Text style={[styles.chatSources, { color: mergedTheme.colors.textSecondary }]}>
                Sources: {message.sources.join(', ')}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.chatInput}>
        <TextInput
          style={[
            styles.chatTextInput,
            { 
              backgroundColor: mergedTheme.colors.background,
              color: mergedTheme.colors.text,
              borderColor: mergedTheme.colors.border
            }
          ]}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Ask about trading concepts..."
          placeholderTextColor={mergedTheme.colors.textSecondary}
          multiline
        />
        <TouchableOpacity
          style={[styles.chatSendButton, { backgroundColor: mergedTheme.colors.primary }]}
          onPress={handleChat}
          disabled={loading || !chatInput.trim()}
        >
          {loading ? (
            <ActivityIndicator color={mergedTheme.colors.background} />
          ) : (
            <Text style={[styles.chatSendText, { color: mergedTheme.colors.background }]}>
              Send
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: mergedTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: mergedTheme.colors.surface }]}>
        <Text style={[styles.title, { color: mergedTheme.colors.primary }]}>
          WealthArena
        </Text>
        {state && (
          <Text style={[styles.balance, { color: mergedTheme.colors.text }]}>
            ${state.balance.toFixed(2)}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {renderTabButton('learn', 'Learn', '📚')}
        {renderTabButton('analyze', 'Analyze', '📊')}
        {renderTabButton('trade', 'Trade', '💹')}
        {renderTabButton('chat', 'Chat', '💬')}
      </View>

      {/* Tab Content */}
      {activeTab === 'learn' && renderLearnTab()}
      {activeTab === 'analyze' && renderAnalyzeTab()}
      {activeTab === 'trade' && renderTradeTab()}
      {activeTab === 'chat' && renderChatTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
  balance: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1f24',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
  activeTabButtonText: {
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Courier New',
  },
  cardText: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  cardSubtext: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: 'Courier New',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
  analysisResults: {
    marginTop: 16,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    fontFamily: 'Courier New',
  },
  signal: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  signalType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Courier New',
  },
  signalExplanation: {
    fontSize: 12,
    lineHeight: 16,
  },
  balanceInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Courier New',
  },
  pnlText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
  tradeForm: {
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
  chatContainer: {
    flex: 1,
    marginBottom: 16,
  },
  chatMessage: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  chatReply: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  chatSources: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: 'Courier New',
    maxHeight: 100,
  },
  chatSendButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Courier New',
  },
});

