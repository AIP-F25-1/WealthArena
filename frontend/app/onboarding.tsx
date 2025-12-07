import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Animated, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  TextInput, 
  tokens 
} from '@/src/design-system';
import CharacterMascot from '@/components/CharacterMascot';

const { width: screenWidth } = Dimensions.get('window');

// Helper function to map mascot variants to valid character types
const getMascotCharacter = (variant?: string): 'neutral' | 'excited' | 'confident' | 'thinking' | 'winner' | 'learning' | 'worried' | 'motivating' | 'happy' | 'sleeping' | 'cautious' | 'celebration' => {
  switch (variant) {
    case 'cautious':
      return 'worried';
    case 'celebration':
      return 'excited';
    case 'learning':
      return 'learning';
    case 'confident':
      return 'confident';
    case 'thinking':
      return 'thinking';
    default:
      return 'excited';
  }
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useUser();
  const {
    sessionId,
    conversationHistory,
    currentQuestion,
    isLoading,
    isTyping,
    estimatedQuestionsRemaining,
    userProfile,
    stage,
    initializeOnboarding,
    submitAnswer,
    skipQuestion,
    goBack,
    completeOnboarding,
    setUserProfile,
    setStage,
    unlockedFeatures,
    nextUnlock,
  } = useOnboarding();

  const [textInput, setTextInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const mascotAnimation = useRef(new Animated.Value(0)).current;
  const typingAnimation = useRef(new Animated.Value(0)).current;
  const celebrationAnimation = useRef(new Animated.Value(0)).current;
  const confettiAnimation = useRef(new Animated.Value(0)).current;

  // Initialize onboarding on mount - only once when user exists and no session
  useEffect(() => {
    if (!sessionId && user) {
      initializeOnboarding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user]); // Removed initializeOnboarding from deps to prevent infinite loop

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationHistory.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversationHistory]);

  // Animate mascot based on typing state
  useEffect(() => {
    if (isTyping) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(mascotAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(mascotAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      mascotAnimation.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping]); // Removed mascotAnimation from deps - refs are stable

  // Animate typing indicator
  useEffect(() => {
    if (isTyping) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      typingAnimation.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping]); // Removed typingAnimation from deps - refs are stable

  // Celebration animations
  useEffect(() => {
    if (stage === 'complete') {
      setShowCelebration(true);
      
      // Reset animations
      confettiAnimation.setValue(0);
      celebrationAnimation.setValue(0);
      
      // Start celebration sequence with continuous confetti animation
      // Confetti should continuously fall and move
      const confettiLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(confettiAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(confettiAnimation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 5 } // Run for 5 cycles
      );
      
      // Mascot celebration animation
      const mascotCelebration = Animated.sequence([
        Animated.timing(celebrationAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationAnimation, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(celebrationAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]);
      
      confettiLoop.start();
      mascotCelebration.start();
      
      return () => {
        confettiLoop.stop();
        mascotCelebration.stop();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]); // Removed animation refs from deps - refs are stable

  const handleChoice = (choice: string) => {
    if (currentQuestion?.questionType === 'multi') {
      const newSelection = selectedOptions.includes(choice)
        ? selectedOptions.filter(opt => opt !== choice)
        : [...selectedOptions, choice];
      setSelectedOptions(newSelection);
    } else {
      submitAnswer(choice);
      setTextInput('');
    }
  };

  const handleMultiSubmit = () => {
    if (selectedOptions.length > 0) {
      submitAnswer(selectedOptions);
      setSelectedOptions([]);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    submitAnswer(textInput);
    setTextInput('');
  };

  const handleAvatarSelection = (variant: string) => {
    // Update user profile with selected avatar
    setUserProfile({
      ...userProfile,
      selectedAvatar: {
        type: 'mascot',
        variant: variant,
      }
    });
    
    // Move to completion stage
    setStage('complete');
  };

  const handleSkipAvatar = () => {
    // Use default avatar
    setUserProfile({
      ...userProfile,
      selectedAvatar: {
        type: 'mascot',
        variant: 'excited',
      }
    });
    
    // Move to completion stage
    setStage('complete');
  };

  const handleComplete = async () => {
    // Prevent multiple calls
    if (isCompleting) {
      console.log('Already completing, ignoring duplicate call');
      return;
    }

    console.log('Get Started button clicked, stage:', stage, 'sessionId:', sessionId);
    setIsCompleting(true);
    
    try {
      // Try to complete onboarding if we have a session
      // But don't block navigation if it fails
      if (sessionId && stage === 'complete') {
        try {
          console.log('Calling completeOnboarding...');
          await completeOnboarding();
          console.log('completeOnboarding succeeded');
        } catch (error) {
          // If it fails, continue anyway - user can still proceed
          console.warn('Onboarding completion call failed, proceeding anyway:', error);
        }
      } else if (!sessionId && stage === 'complete') {
        // No session but stage is complete - try to mark as complete in backend anyway
        console.log('No sessionId but stage is complete, trying to mark complete in backend...');
        try {
          const { apiService } = await import('@/services/apiService');
          await apiService.completeUserOnboarding({
            sessionId: sessionId || 'fallback-session',
            conversationHistory: [],
            userAnswers: [],
            userProfile: userProfile || {},
            selectedAvatar: userProfile?.selectedAvatar || {
              type: 'mascot',
              variant: 'excited'
            },
          });
          console.log('Backend completion succeeded without session');
        } catch (error) {
          console.warn('Backend completion failed, proceeding anyway:', error);
        }
      }
      
      // Navigate immediately - don't wait for completion
      console.log('Navigating to dashboard...');
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Navigate anyway even if completion fails
      console.log('Navigating to dashboard despite error...');
      router.replace('/(tabs)/dashboard');
    } finally {
      // Reset after a delay in case navigation fails
      setTimeout(() => {
        setIsCompleting(false);
      }, 2000);
    }
  };

  const handleSkip = () => {
    skipQuestion();
  };

  const handleBack = () => {
    goBack();
  };

  // Calculate progress based on actual questions answered
  // Count only bot messages that are questions (not explanations or welcome messages)
  const questionCount = conversationHistory.filter(m => m.isBot && (m.type === 'question' || m.questionType)).length;
  const answeredCount = conversationHistory.filter(m => !m.isBot).length;
  const totalEstimated = questionCount + estimatedQuestionsRemaining;
  const progress = totalEstimated > 0 
    ? Math.min(100, (answeredCount / totalEstimated) * 100)
    : 0;

  // Show loading screen while initializing (but only if we're not already at completion stage)
  if (isLoading && !sessionId && stage !== 'complete') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.mascotContainer,
              {
                transform: [
                  {
                    scale: mascotAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.1],
                    }),
                  },
                ],
              },
            ]}
          >
            <CharacterMascot character="excited" size={80} />
          </Animated.View>
          <Text variant="h3" style={[styles.loadingText, { color: theme.text }]}>
            Setting up your personalized experience...
          </Text>
          <Text variant="small" style={[{ color: theme.muted, marginTop: 16, opacity: 0.7 }]}>
            {user ? `Welcome, ${user.firstName || user.username}!` : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // If stage is complete but we're still loading, allow user to proceed anyway
  if (isLoading && stage === 'complete') {
    console.log('Stage is complete but isLoading is true - allowing user to proceed');
  }

  // Safety fallback - if somehow we're not loading but have no content
  if (!isLoading && conversationHistory.length === 0 && !sessionId) {
    console.warn('Onboarding in unexpected state - no content, not loading, no session');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <CharacterMascot character="worried" size={80} />
          <Text variant="h3" style={[styles.loadingText, { color: theme.text }]}>
            Something went wrong
          </Text>
          <Text variant="body" style={[{ color: theme.muted, marginTop: 16, opacity: 0.7 }]}>
            Let's try again
          </Text>
          <Button 
            variant="primary" 
            onPress={() => {
              console.log('Retrying onboarding initialization...');
              initializeOnboarding();
            }}
            style={{ marginTop: 24 }}
          >
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header with Progress */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: theme.primary, width: `${progress}%` }
                ]} 
              />
            </View>
            <Text variant="small" muted>
              {stage === 'avatar' ? 'Choose your companion' 
                : stage === 'complete' ? 'Complete!'
                : stage === 'questions' ? 'Answer a few questions to get started'
                : 'Welcome!'
              }
            </Text>
          </View>
        </View>

        {/* Chat Messages - Hide when showing avatar selection or completion */}
        {stage !== 'avatar' && stage !== 'complete' && (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {conversationHistory.map((message, index) => (
            <View key={message.id} style={styles.messageContainer}>
              {message.isBot ? (
                <View style={styles.botMessage}>
                  <View style={styles.botAvatar}>
                    <CharacterMascot 
                      character={getMascotCharacter(message.mascotVariant)} 
                      size={40} 
                    />
                  </View>
                  <Card style={[styles.botBubble, { backgroundColor: theme.surface }]} elevation="low">
                    <Text variant="body" color={theme.text}>
                      {message.text}
                    </Text>
                  </Card>
                </View>
              ) : (
                <View style={styles.userMessage}>
                  <Card style={[styles.userBubble, { backgroundColor: theme.primary }]} elevation="low">
                    <Text variant="body" style={[styles.userText, { color: '#FFFFFF' }]}>
                      {message.text}
                    </Text>
                  </Card>
                </View>
              )}
            </View>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={styles.messageContainer}>
              <View style={styles.botMessage}>
                <View style={styles.botAvatar}>
                  <Animated.View
                    style={[
                      styles.typingMascot,
                      {
                        transform: [
                          {
                            scale: mascotAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.05],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <CharacterMascot character="learning" size={40} />
                  </Animated.View>
                </View>
                <Card style={[styles.botBubble, { backgroundColor: theme.surface }]} elevation="low">
                  <View style={styles.typingContainer}>
                    <Animated.View
                      style={[
                        styles.typingDot,
                        {
                          backgroundColor: theme.muted,
                          opacity: typingAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.typingDot,
                        {
                          backgroundColor: theme.muted,
                          opacity: typingAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.typingDot,
                        {
                          backgroundColor: theme.muted,
                          opacity: typingAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                        },
                      ]}
                    />
                  </View>
                </Card>
              </View>
            </View>
          )}
        </ScrollView>
        )}

        {/* Input Section - Hide when showing avatar selection or completion */}
        {stage !== 'avatar' && stage !== 'complete' && currentQuestion && !isTyping && (
          <View style={[styles.inputSection, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {/* Choice Options */}
            {currentQuestion.questionType === 'choice' && currentQuestion.options && (
              <View style={styles.optionsContainer}>
                <View style={styles.optionsGrid}>
                  {currentQuestion.options.map((option) => (
                    <Button
                      key={option}
                      variant="secondary"
                      size="medium"
                      onPress={() => handleChoice(option)}
                      style={styles.optionButton}
                    >
                      {option.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </View>
              </View>
            )}

            {/* Multi-select Options */}
            {currentQuestion.questionType === 'multi' && currentQuestion.options && (
              <View style={styles.optionsContainer}>
                <View style={styles.optionsGrid}>
                  {currentQuestion.options.map((option) => (
                    <Button
                      key={option}
                      variant={selectedOptions.includes(option) ? "primary" : "secondary"}
                      size="medium"
                      onPress={() => handleChoice(option)}
                      style={styles.optionButton}
                    >
                      {option.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </View>
                {selectedOptions.length > 0 && (
                  <Button
                    variant="primary"
                    size="large"
                    onPress={handleMultiSubmit}
                    fullWidth
                    style={styles.submitButton}
                  >
                    Continue ({selectedOptions.length} selected)
                  </Button>
                )}
              </View>
            )}

            {/* Text Input - Show for text questions OR welcome messages */}
            {(currentQuestion.questionType === 'text' || currentQuestion.type === 'explanation' || !currentQuestion.questionType) && (
              <View style={styles.textInputContainer}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    placeholder="Type your answer here..."
                    value={textInput}
                    onChangeText={setTextInput}
                    autoCapitalize="sentences"
                    onSubmitEditing={handleTextSubmit}
                    returnKeyType="done"
                    style={styles.textInput}
                    multiline={false}
                  />
                </View>
                <Pressable
                  onPress={handleTextSubmit}
                  style={[
                    styles.submitButton,
                    { backgroundColor: textInput.trim() ? theme.primary : theme.border }
                  ]}
                  disabled={!textInput.trim()}
                >
                  <Text variant="small" weight="semibold" style={{ color: '#FFFFFF' }}>
                    Send
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {conversationHistory.length > 1 && (
                <Button
                  variant="ghost"
                  size="small"
                  onPress={handleBack}
                  style={styles.backButton}
                >
                  ← Back
                </Button>
              )}
              
              {currentQuestion && (
                <Button
                  variant="ghost"
                  size="small"
                  onPress={handleSkip}
                  style={styles.skipButton}
                >
                  Skip →
                </Button>
              )}
            </View>
          </View>
        )}

        {/* Avatar Selection Screen */}
        {stage === 'avatar' && (
          <ScrollView 
            style={styles.avatarSelectionScrollView}
            contentContainerStyle={styles.avatarSelectionContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <Text variant="h2" style={[styles.avatarTitle, { color: theme.primary }]}>
              Choose Your Trading Companion
            </Text>
            <Text variant="body" style={[styles.avatarSubtitle, { color: theme.muted }]}>
              Based on your personality, I recommend these avatars:
            </Text>
            
            <View style={styles.avatarGrid}>
              {[
                { variant: 'excited', name: 'The Optimist', description: 'Always ready for new opportunities' },
                { variant: 'confident', name: 'The Strategist', description: 'Calculated and methodical' },
                { variant: 'learning', name: 'The Scholar', description: 'Curious and analytical' },
                { variant: 'thinking', name: 'The Analyst', description: 'Data-driven and precise' },
              ].map((avatar) => (
                <Button
                  key={avatar.variant}
                  variant="secondary"
                  size="large"
                  onPress={() => handleAvatarSelection(avatar.variant)}
                  style={styles.avatarOption}
                >
                  <View style={styles.avatarPreview}>
                    <CharacterMascot character={avatar.variant as any} size={60} />
                    <Text variant="small" style={[styles.avatarName, { color: theme.text }]}>
                      {avatar.name}
                    </Text>
                    <Text variant="xs" style={[styles.avatarDescription, { color: theme.muted }]}>
                      {avatar.description}
                    </Text>
                  </View>
                </Button>
              ))}
            </View>

            <Button
              variant="ghost"
              size="medium"
              onPress={handleSkipAvatar}
              style={styles.skipAvatarButton}
            >
              I'll choose later
            </Button>
          </ScrollView>
        )}

        {/* Completion Screen */}
        {stage === 'complete' && (
          <ScrollView 
            style={styles.completionScrollView}
            contentContainerStyle={styles.completionContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            pointerEvents="box-none"
          >
            {/* Confetti Effect */}
            {showCelebration && (
              <Animated.View
                style={[
                  styles.confettiContainer,
                  {
                    opacity: confettiAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                ]}
              >
                {new Array(30).fill(null).map((_, i) => {
                  const uniqueId = `confetti-${i}-${Date.now()}`;
                  const startX = (Math.random() - 0.5) * screenWidth;
                  const startY = -50 - Math.random() * 100;
                  const endX = startX + (Math.random() - 0.5) * 300;
                  const endY = screenWidth * 2; // Fall to bottom of screen
                  const rotation = Math.random() * 360;
                  
                  return (
                    <Animated.View
                      key={uniqueId}
                      style={[
                        styles.confetti,
                        {
                          backgroundColor: ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#FF6B9D', '#C44569'][i % 6],
                          left: `${50 + (Math.random() - 0.5) * 100}%`,
                          transform: [
                            {
                              translateY: confettiAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [startY, endY],
                              }),
                            },
                            {
                              translateX: confettiAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, endX - startX],
                              }),
                            },
                            {
                              rotate: confettiAnimation.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', `${rotation}deg`],
                              }),
                            },
                            {
                              scale: confettiAnimation.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 1.2, 0.8],
                              }),
                            },
                          ],
                          opacity: confettiAnimation.interpolate({
                            inputRange: [0, 0.3, 0.7, 1],
                            outputRange: [0, 1, 1, 0],
                          }),
                        },
                      ]}
                    />
                  );
                })}
              </Animated.View>
            )}

            <Animated.View
              style={[
                styles.celebrationMascot,
                {
                  transform: [
                    {
                      scale: celebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.2],
                      }),
                    },
                    {
                      rotate: celebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '5deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <CharacterMascot character="excited" size={80} />
            </Animated.View>

            <Animated.View
              style={[
                styles.completionContent,
                {
                  opacity: celebrationAnimation,
                  transform: [
                    {
                      translateY: celebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text variant="h2" style={[styles.completionTitle, { color: theme.primary }]}>
                <Text style={{ fontSize: 32, lineHeight: 40, includeFontPadding: false }}>🎉</Text> Welcome to WealthArena!
              </Text>
              <Text variant="body" style={[styles.completionText, { color: theme.muted }]}>
                Your profile is ready. Let's start your trading journey!
              </Text>

              {/* Rewards Display */}
              <View style={styles.rewardsContainer}>
                <View style={[styles.rewardItem, { backgroundColor: theme.border }]}>
                  <Text variant="h3" style={[styles.rewardAmount, { color: theme.primary }]}>+50 XP</Text>
                  <Text variant="small" style={[styles.rewardLabel, { color: theme.muted }]}>Welcome Bonus</Text>
                </View>
                <View style={[styles.rewardItem, { backgroundColor: theme.border }]}>
                  <Text variant="h3" style={[styles.rewardAmount, { color: theme.primary }]}>+500 Coins</Text>
                  <Text variant="small" style={[styles.rewardLabel, { color: theme.muted }]}>Starting Capital</Text>
                </View>
                <View style={[styles.rewardItem, { backgroundColor: theme.border }]}>
                  <Text variant="h3" style={[styles.rewardAmount, { color: theme.primary }]}>
                    <Text style={{ fontSize: 24, lineHeight: 28, includeFontPadding: false }}>🏆</Text>
                  </Text>
                  <Text variant="small" style={[styles.rewardLabel, { color: theme.muted }]}>First Achievement</Text>
                </View>
              </View>

              {/* Features Unlocked */}
              {unlockedFeatures && unlockedFeatures.length > 0 && (
                <View style={[styles.unlockedContainer, { backgroundColor: theme.border }]}>
                  <Text variant="small" weight="semibold" style={{ marginBottom: tokens.spacing.xs }}>
                    <Text style={{ fontSize: 14, lineHeight: 18, includeFontPadding: false }}>✅</Text> Features Unlocked
                  </Text>
                  <Text variant="xs" muted>
                    {unlockedFeatures.join(', ').replace(/_/g, ' ')}
                  </Text>
                  {nextUnlock && (
                    <Text variant="xs" style={{ marginTop: tokens.spacing.xs, color: theme.primary }}>
                      Next: Unlock {nextUnlock.feature.replace(/_/g, ' ')} at {nextUnlock.xpNeeded} more XP
                    </Text>
                  )}
                </View>
              )}

              <Button
                variant="primary"
                size="large"
                onPress={() => {
                  console.log('Get Started button pressed!', {
                    isCompleting,
                    isLoading,
                    stage,
                    sessionId,
                    hasUser: !!user
                  });
                  handleComplete();
                }}
                fullWidth
                style={styles.completeButton}
                disabled={isCompleting}
              >
                {isCompleting ? 'Loading...' : 'Get Started'}
              </Button>
            </Animated.View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'space-between',
  },
  
  // Loading Screen
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  mascotContainer: {
    alignItems: 'center',
  },
  loadingText: {
    textAlign: 'center',
    // Color will be set dynamically via theme.text
  },

  // Header
  header: {
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
    // borderBottomColor will be set dynamically via theme.border
  },
  progressContainer: {
    gap: tokens.spacing.sm,
    alignItems: 'center',
    width: '100%',
  },
  progressBg: {
    height: 8,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },

  // Chat Interface
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
    alignItems: 'stretch', // Ensure messages can take full width
  },
  messageContainer: {
    marginBottom: tokens.spacing.sm,
    width: '100%',
  },
  
  // Bot Messages
  botMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    width: '100%',
    paddingHorizontal: tokens.spacing.xs,
  },
  botAvatar: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.xs,
    flexShrink: 0, // Prevent avatar from shrinking
  },
  botBubble: {
    flex: 1,
    maxWidth: screenWidth * 0.75,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    // backgroundColor will be set dynamically via theme.surface
  },
  botText: {
    // Color will be set dynamically via theme.text
  },
  
  // User Messages
  userMessage: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    paddingHorizontal: tokens.spacing.xs,
  },
  userBubble: {
    maxWidth: screenWidth * 0.75,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    // backgroundColor will be set dynamically via theme.primary
  },
  userText: {
    // color will be set dynamically to white for contrast
  },

  // Typing Indicator
  typingMascot: {
    alignItems: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // backgroundColor will be set dynamically via theme.muted
  },

  // Input Section
  inputSection: {
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
    // borderTopColor and backgroundColor will be set dynamically via theme
  },
  optionsContainer: {
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
    alignItems: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    justifyContent: 'center',
    width: '100%',
  },
  optionButton: {
    marginBottom: tokens.spacing.xs,
    minWidth: screenWidth < 400 ? '45%' : 'auto', // Responsive sizing
    maxWidth: screenWidth < 400 ? '45%' : '48%',
    flexGrow: 1,
    flexShrink: 0,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  textInput: {
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
  submitButton: {
    minWidth: 60,
    height: 44,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    flexShrink: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
    width: '100%',
  },
  backButton: {
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  skipButton: {
    flex: 1,
    marginLeft: tokens.spacing.sm,
  },

  // Completion Screen
  completionScrollView: {
    flex: 1,
  },
  completionContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xl * 2, // Extra padding for scroll
    gap: tokens.spacing.lg,
  },
  celebrationMascot: {
    alignItems: 'center',
  },
  completionTitle: {
    textAlign: 'center',
    // color will be set dynamically via theme.primary
  },
  completionText: {
    textAlign: 'center',
    // color will be set dynamically via theme.muted
    marginBottom: tokens.spacing.lg,
  },
  completeButton: {
    marginTop: tokens.spacing.md,
    width: '100%',
  },
  completeButtonInner: {
    width: '100%',
  },

  // Avatar Selection
  avatarSelectionScrollView: {
    flex: 1,
  },
  avatarSelectionContainer: {
    padding: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl * 2, // Extra padding for scroll
    gap: tokens.spacing.lg,
    minHeight: '100%',
  },
  avatarTitle: {
    textAlign: 'center',
    // color will be set dynamically via theme.primary
    marginBottom: tokens.spacing.sm,
  },
  avatarSubtitle: {
    textAlign: 'center',
    // color will be set dynamically via theme.muted
    marginBottom: tokens.spacing.lg,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
  },
  avatarOption: {
    width: screenWidth < 400 ? '100%' : '48%', // Full width on small screens
    padding: tokens.spacing.md,
    alignItems: 'center',
    minHeight: 140,
  },
  avatarPreview: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  avatarName: {
    fontWeight: '600',
    // color will be set dynamically via theme.text
  },
  avatarDescription: {
    textAlign: 'center',
    // color will be set dynamically via theme.muted
  },
  skipAvatarButton: {
    marginTop: tokens.spacing.lg,
    alignSelf: 'center',
  },

  // Celebration Effects
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  completionContent: {
    alignItems: 'center',
    gap: tokens.spacing.lg,
  },
  rewardsContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginVertical: tokens.spacing.lg,
  },
  rewardItem: {
    alignItems: 'center',
    padding: tokens.spacing.md,
    // backgroundColor will be set dynamically via theme.border
    borderRadius: tokens.radius.md,
    minWidth: 80,
  },
  rewardAmount: {
    // color will be set dynamically via theme.primary
    fontWeight: '700',
  },
  rewardLabel: {
    // color will be set dynamically via theme.muted
    textAlign: 'center',
  },
  unlockedContainer: {
    marginTop: tokens.spacing.sm,
    padding: tokens.spacing.md,
    // backgroundColor will be set dynamically via theme.border
    borderRadius: tokens.radius.md,
    width: '100%',
  },
});
