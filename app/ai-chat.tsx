import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, Keyboard, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, TextInput, Icon, tokens } from '@/src/design-system';
import { Ionicons } from '@expo/vector-icons';
import AISignalCard from '../components/AISignalCard';
import { AITradingSignal } from '../types/ai-signal';

interface Message {
  id: string;
  text?: string;
  isBot: boolean;
  signal?: AITradingSignal;
  type?: 'text' | 'signal';
}

const QUICK_QUESTIONS = [
  'Show me top 3 AI signals',
  'What is portfolio diversification?',
  'How do I manage risk?',
  'Explain technical indicators',
  'What is value investing?',
];

// Mock AI Signal Data (will be replaced with API call)
const MOCK_AI_SIGNALS: AITradingSignal[] = [
  {
    symbol: "AAPL",
    prediction_date: "2024-10-04T19:30:00Z",
    asset_type: "stock",
    
    trading_signal: {
      signal: "BUY",
      confidence: 0.8700,
      model_version: "v2.3.1"
    },
    
    entry_strategy: {
      price: 175.50,
      price_range: [174.80, 176.20],
      timing: "immediate",
      reasoning: "Strong momentum with favorable setup"
    },
    
    take_profit_levels: [
      {
        level: 1,
        price: 180.00,
        percent_gain: 2.56,
        close_percent: 50,
        probability: 0.75,
        reasoning: "First resistance level"
      },
      {
        level: 2,
        price: 185.00,
        percent_gain: 5.41,
        close_percent: 30,
        probability: 0.55,
        reasoning: "Major resistance zone"
      },
      {
        level: 3,
        price: 190.00,
        percent_gain: 8.26,
        close_percent: 20,
        probability: 0.35,
        reasoning: "Extended target"
      }
    ],
    
    stop_loss: {
      price: 171.00,
      percent_loss: -2.56,
      type: "trailing",
      trail_amount: 2.50,
      reasoning: "Below recent support"
    },
    
    risk_management: {
      risk_reward_ratio: 3.20,
      max_risk_per_share: 4.50,
      max_reward_per_share: 14.50,
      win_probability: 0.68,
      expected_value: 7.82
    },
    
    position_sizing: {
      recommended_percent: 5.0,
      dollar_amount: 6142.00,
      shares: 35,
      max_loss: 157.50,
      method: "Kelly Criterion",
      kelly_fraction: 0.053,
      volatility_adjusted: true
    },
    
    model_metadata: {
      model_type: "Multi-Agent RL",
      agents_used: ["TradingAgent", "RiskAgent", "PortfolioAgent"],
      training_date: "2024-10-01",
      backtest_sharpe: 1.95,
      feature_importance: {
        RSI: 0.18,
        MACD: 0.15,
        Momentum_10: 0.12,
        Volume_Ratio: 0.10,
        Price_Action: 0.09
      }
    },
    
    indicators_state: {
      rsi: { value: 58.3, status: "neutral" },
      macd: { value: 0.85, status: "bullish" },
      atr: { value: 2.45, status: "medium_volatility" },
      volume: { value: 1.15, status: "above_average" },
      trend: { direction: "up", strength: "strong" }
    }
  },
  {
    symbol: "TSLA",
    prediction_date: "2024-10-04T19:30:00Z",
    asset_type: "stock",
    
    trading_signal: {
      signal: "SELL",
      confidence: 0.7800,
      model_version: "v2.3.1"
    },
    
    entry_strategy: {
      price: 227.20,
      price_range: [226.50, 228.00],
      timing: "immediate",
      reasoning: "Overbought conditions with weakening momentum"
    },
    
    take_profit_levels: [
      {
        level: 1,
        price: 220.00,
        percent_gain: 3.17,
        close_percent: 50,
        probability: 0.70,
        reasoning: "First support level"
      },
      {
        level: 2,
        price: 215.00,
        percent_gain: 5.37,
        close_percent: 30,
        probability: 0.50,
        reasoning: "Major support zone"
      },
      {
        level: 3,
        price: 210.00,
        percent_gain: 7.57,
        close_percent: 20,
        probability: 0.30,
        reasoning: "Extended downside target"
      }
    ],
    
    stop_loss: {
      price: 232.00,
      percent_loss: -2.11,
      type: "fixed",
      reasoning: "Above recent resistance"
    },
    
    risk_management: {
      risk_reward_ratio: 2.50,
      max_risk_per_share: 4.80,
      max_reward_per_share: 12.00,
      win_probability: 0.62,
      expected_value: 5.84
    },
    
    position_sizing: {
      recommended_percent: 4.0,
      dollar_amount: 4544.00,
      shares: 20,
      max_loss: 96.00,
      method: "Kelly Criterion",
      kelly_fraction: 0.042,
      volatility_adjusted: true
    },
    
    model_metadata: {
      model_type: "Multi-Agent RL",
      agents_used: ["TradingAgent", "RiskAgent", "PortfolioAgent"],
      training_date: "2024-10-01",
      backtest_sharpe: 1.88,
      feature_importance: {
        RSI: 0.20,
        MACD: 0.16,
        Momentum_10: 0.14,
        Volatility: 0.11,
        Volume_Trend: 0.08
      }
    },
    
    indicators_state: {
      rsi: { value: 72.5, status: "bearish" },
      macd: { value: -0.45, status: "bearish" },
      atr: { value: 3.80, status: "high_volatility" },
      volume: { value: 0.95, status: "below_average" },
      trend: { direction: "down", strength: "moderate" }
    }
  },
  {
    symbol: "GOOGL",
    prediction_date: "2024-10-04T19:30:00Z",
    asset_type: "stock",
    
    trading_signal: {
      signal: "BUY",
      confidence: 0.9100,
      model_version: "v2.3.1"
    },
    
    entry_strategy: {
      price: 138.40,
      price_range: [137.80, 139.00],
      timing: "immediate",
      reasoning: "Breakout above key resistance with strong volume"
    },
    
    take_profit_levels: [
      {
        level: 1,
        price: 143.00,
        percent_gain: 3.32,
        close_percent: 50,
        probability: 0.80,
        reasoning: "First resistance at prior high"
      },
      {
        level: 2,
        price: 148.00,
        percent_gain: 6.94,
        close_percent: 30,
        probability: 0.60,
        reasoning: "Major resistance zone"
      },
      {
        level: 3,
        price: 153.00,
        percent_gain: 10.55,
        close_percent: 20,
        probability: 0.40,
        reasoning: "Extended target"
      }
    ],
    
    stop_loss: {
      price: 135.00,
      percent_loss: -2.46,
      type: "trailing",
      trail_amount: 2.00,
      reasoning: "Below breakout level"
    },
    
    risk_management: {
      risk_reward_ratio: 4.20,
      max_risk_per_share: 3.40,
      max_reward_per_share: 14.60,
      win_probability: 0.75,
      expected_value: 9.55
    },
    
    position_sizing: {
      recommended_percent: 6.0,
      dollar_amount: 8304.00,
      shares: 60,
      max_loss: 204.00,
      method: "Kelly Criterion",
      kelly_fraction: 0.062,
      volatility_adjusted: true
    },
    
    model_metadata: {
      model_type: "Multi-Agent RL",
      agents_used: ["TradingAgent", "RiskAgent", "PortfolioAgent"],
      training_date: "2024-10-01",
      backtest_sharpe: 2.15,
      feature_importance: {
        Volume_Breakout: 0.22,
        RSI: 0.17,
        MACD: 0.16,
        Support_Resistance: 0.15,
        Momentum_10: 0.13
      }
    },
    
    indicators_state: {
      rsi: { value: 62.8, status: "bullish" },
      macd: { value: 1.20, status: "bullish" },
      atr: { value: 2.10, status: "medium_volatility" },
      volume: { value: 1.45, status: "above_average" },
      trend: { direction: "up", strength: "strong" }
    }
  }
];

export default function AIChatScreen() {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI trading assistant. How can I help you today?",
      isBot: true,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Handle keyboard events for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
      
      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });

      const dimensionListener = Dimensions.addEventListener('change', ({ window }) => {
        setScreenHeight(window.height);
      });

      return () => {
        keyboardDidShowListener?.remove();
        keyboardDidHideListener?.remove();
        dimensionListener?.remove();
      };
    }
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      type: 'text',
    };
    
    setMessages(prev => [...prev, userMessage]);
    const userQuestion = inputText.trim().toLowerCase();
    setInputText('');

    // Check if user is asking for AI signals
    if (userQuestion.includes('signal') || userQuestion.includes('top 3')) {
      // First, show a text response
      setTimeout(() => {
        const textResponse: Message = {
          id: Date.now().toString(),
          text: "Here are the top 3 AI trading signals based on our latest analysis:",
          isBot: true,
          type: 'text',
        };
        setMessages(prev => [...prev, textResponse]);

        // Then show each signal
        MOCK_AI_SIGNALS.forEach((signal, index) => {
          setTimeout(() => {
            const signalMessage: Message = {
              id: `${Date.now()}-signal-${index}`,
              signal: signal,
              isBot: true,
              type: 'signal',
            };
            setMessages(prev => [...prev, signalMessage]);
          }, (index + 1) * 500);
        });
      }, 800);
    } else {
      // Regular bot response
      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "That's a great question! I'm here to help you understand trading concepts better. Let me explain...",
          isBot: true,
          type: 'text',
        };
        setMessages(prev => [...prev, botMessage]);
      }, 1000);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.bg }]} 
      edges={['top']}
    >
      {Platform.OS === 'android' ? (
        <View style={[styles.androidContainer, { height: screenHeight - keyboardHeight }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable 
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Icon name="agent" size={24} color={theme.primary} />
              <Text variant="h3" weight="bold">AI Assistant</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => {
              const botBgColor = mode === 'dark' ? '#1F2937' : '#E5E7EB';
              
              // Handle signal messages differently
              if (message.type === 'signal' && message.signal) {
                return (
                  <View key={message.id} style={styles.signalMessageContainer}>
                    <AISignalCard signal={message.signal} />
                  </View>
                );
              }

              // Handle text messages
              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    message.isBot ? styles.botMessageRow : styles.userMessageRow,
                  ]}
                >
                  {message.isBot && (
                    <View style={[styles.avatarCircle, { backgroundColor: theme.primary + '20' }]}>
                      <Icon name="agent" size={20} color={theme.primary} />
                    </View>
                  )}
                  <Card
                    style={{
                      ...styles.messageBubble,
                      backgroundColor: message.isBot ? botBgColor : theme.primary,
                      borderWidth: message.isBot ? 1 : 0,
                      borderColor: message.isBot ? theme.border : 'transparent',
                    }}
                    padding="sm"
                  >
                    <Text 
                      variant="body" 
                      color={message.isBot ? theme.text : '#FFFFFF'}
                    >
                      {message.text}
                    </Text>
                  </Card>
                  {!message.isBot && (
                    <View style={[styles.avatarCircle, { backgroundColor: theme.accent + '20' }]}>
                      <Icon name="agent" size={20} color={theme.accent} />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Quick Questions */}
            {messages.length === 1 && (
              <View style={styles.quickQuestionsContainer}>
                <Text variant="small" muted style={styles.quickQuestionsTitle}>
                  Quick questions:
                </Text>
                {QUICK_QUESTIONS.map((question) => (
                  <Pressable
                    key={question}
                    onPress={() => handleQuickQuestion(question)}
                  >
                    <Card style={styles.quickQuestionCard}>
                      <Text variant="small">{question}</Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View 
            style={[
              styles.inputContainer, 
              { 
                backgroundColor: theme.surface, 
                borderTopColor: theme.border,
              }
            ]}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="Ask me anything about trading..."
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={[
                  styles.input,
                  Platform.OS === 'android' && {
                    borderWidth: isFocused ? 2 : 1,
                    borderColor: isFocused ? theme.primary : theme.border,
                  }
                ]}
                {...(Platform.OS === 'android' && {
                  multiline: false,
                  numberOfLines: 1,
                  maxLength: 500,
                  returnKeyType: 'send',
                  onSubmitEditing: handleSend,
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  underlineColorAndroid: 'transparent',
                  autoCorrect: false,
                  autoCapitalize: 'sentences',
                  selectionColor: theme.primary,
                  placeholderTextColor: theme.muted,
                })}
              />
            </View>
            <Pressable
              onPress={handleSend}
              style={[
                styles.sendButton,
                { backgroundColor: inputText.trim() ? theme.primary : theme.border }
              ]}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior="padding"
          keyboardVerticalOffset={0}
          enabled={true}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable 
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Icon name="agent" size={24} color={theme.primary} />
              <Text variant="h3" weight="bold">AI Assistant</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => {
              const botBgColor = mode === 'dark' ? '#1F2937' : '#E5E7EB';
              
              // Handle signal messages differently
              if (message.type === 'signal' && message.signal) {
                return (
                  <View key={message.id} style={styles.signalMessageContainer}>
                    <AISignalCard signal={message.signal} />
                  </View>
                );
              }

              // Handle text messages
              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    message.isBot ? styles.botMessageRow : styles.userMessageRow,
                  ]}
                >
                  {message.isBot && (
                    <View style={[styles.avatarCircle, { backgroundColor: theme.primary + '20' }]}>
                      <Icon name="agent" size={20} color={theme.primary} />
                    </View>
                  )}
                  <Card
                    style={{
                      ...styles.messageBubble,
                      backgroundColor: message.isBot ? botBgColor : theme.primary,
                      borderWidth: message.isBot ? 1 : 0,
                      borderColor: message.isBot ? theme.border : 'transparent',
                    }}
                    padding="sm"
                  >
                    <Text 
                      variant="body" 
                      color={message.isBot ? theme.text : '#FFFFFF'}
                    >
                      {message.text}
                    </Text>
                  </Card>
                  {!message.isBot && (
                    <View style={[styles.avatarCircle, { backgroundColor: theme.accent + '20' }]}>
                      <Icon name="agent" size={20} color={theme.accent} />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Quick Questions */}
            {messages.length === 1 && (
              <View style={styles.quickQuestionsContainer}>
                <Text variant="small" muted style={styles.quickQuestionsTitle}>
                  Quick questions:
                </Text>
                {QUICK_QUESTIONS.map((question) => (
                  <Pressable
                    key={question}
                    onPress={() => handleQuickQuestion(question)}
                  >
                    <Card style={styles.quickQuestionCard}>
                      <Text variant="small">{question}</Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View 
            style={[
              styles.inputContainer, 
              { 
                backgroundColor: theme.surface, 
                borderTopColor: theme.border,
              }
            ]}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="Ask me anything about trading..."
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={styles.input}
              />
            </View>
            <Pressable
              onPress={handleSend}
              style={[
                styles.sendButton,
                { backgroundColor: inputText.trim() ? theme.primary : theme.border }
              ]}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  androidContainer: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  botMessageRow: {
    justifyContent: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
  },
  signalMessageContainer: {
    width: '100%',
    marginBottom: tokens.spacing.sm,
  },
  botMessage: {},
  userMessage: {},
  quickQuestionsContainer: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  quickQuestionsTitle: {
    marginBottom: tokens.spacing.xs,
  },
  quickQuestionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    borderTopWidth: 1,
    ...(Platform.OS === 'android' && {
      paddingBottom: tokens.spacing.sm,
      paddingVertical: tokens.spacing.sm,
      minHeight: 60,
    }),
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    minHeight: 44,
    maxHeight: 100,
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      maxHeight: 48,
      minHeight: 48,
      fontSize: 16,
      lineHeight: 20,
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
      textAlignVertical: 'center',
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'android' && {
      marginTop: 0,
    }),
    ...(Platform.OS === 'ios' && {
      marginTop: -12,
    }),
  },
});
