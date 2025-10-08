import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserTier } from '@/contexts/UserTierContext';
import { 
  useTheme, 
  Text, 
  Card, 
  Button, 
  TextInput, 
  FoxCoach,
  tokens 
} from '@/src/design-system';

interface OnboardingQuestion {
  question: string;
  type: 'text' | 'choice';
  options?: string[];
}

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    question: "Welcome to WealthArena! What's your name?",
    type: 'text',
  },
  {
    question: "Great to meet you! Have you invested in stocks before?",
    type: 'choice',
    options: ['Never', 'A little', 'Yes, regularly'],
  },
  {
    question: "What's your primary investment goal?",
    type: 'choice',
    options: ['Learn the basics', 'Build wealth', 'Beat the market', 'Retirement planning'],
  },
  {
    question: "How comfortable are you with investment risk?",
    type: 'choice',
    options: ['Very cautious', 'Moderate', 'Aggressive'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { setUserTier, updateProfile } = useUserTier();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');

  const currentQuestion = ONBOARDING_QUESTIONS[currentStep];
  const isLastStep = currentStep === ONBOARDING_QUESTIONS.length - 1;

  const handleChoice = (choice: string) => {
    const newAnswers = [...answers, choice];
    setAnswers(newAnswers);

    if (isLastStep) {
      completeOnboarding(newAnswers);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;

    const newAnswers = [...answers, textInput];
    setAnswers(newAnswers);
    setTextInput('');

    if (isLastStep) {
      completeOnboarding(newAnswers);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const completeOnboarding = (finalAnswers: string[]) => {
    // Determine tier based on answers
    const experienceLevel = finalAnswers[1];
    const tier: 'beginner' | 'intermediate' = 
      (experienceLevel === 'Never') ? 'beginner' : 'intermediate';

    setUserTier(tier);
    updateProfile({
      name: finalAnswers[0] || 'Trader',
      tier,
    });

    router.replace('/(tabs)/dashboard');
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setAnswers(answers.slice(0, -1));
    }
  };

  const progress = ((currentStep + 1) / ONBOARDING_QUESTIONS.length) * 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress Bar */}
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
              Step {currentStep + 1} of {ONBOARDING_QUESTIONS.length}
            </Text>
          </View>

          {/* Question Card */}
          <Card style={styles.questionCard} elevation="med">
            <FoxCoach 
              message={currentQuestion.question}
              variant="excited"
            />
          </Card>

            {/* Answer Options */}
            {currentQuestion.type === 'choice' && currentQuestion.options && (
              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((option) => (
                  <Button
                    key={option}
                    variant="secondary"
                    size="large"
                    onPress={() => handleChoice(option)}
                    fullWidth
                    style={styles.optionButton}
                  >
                    {option}
                  </Button>
                ))}
              </View>
            )}

          {/* Text Input */}
          {currentQuestion.type === 'text' && (
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Type your answer here..."
                value={textInput}
                onChangeText={setTextInput}
                autoCapitalize="words"
                onSubmitEditing={handleTextSubmit}
                returnKeyType="done"
              />
              <Button
                variant="primary"
                size="large"
                onPress={handleTextSubmit}
                disabled={!textInput.trim()}
                fullWidth
                style={styles.submitButton}
              >
                Continue
              </Button>
            </View>
          )}

          {/* Back Button */}
          {currentStep > 0 && (
            <Button
              variant="ghost"
              size="medium"
              onPress={handleBack}
              fullWidth
              style={styles.backButton}
            >
              Back
            </Button>
          )}

          {/* Bottom Spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  progressContainer: {
    gap: tokens.spacing.sm,
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
  questionCard: {
    marginTop: tokens.spacing.lg,
  },
  optionsContainer: {
    gap: tokens.spacing.sm,
  },
  optionButton: {
    marginBottom: tokens.spacing.xs,
  },
  inputContainer: {
    gap: tokens.spacing.md,
  },
  submitButton: {
    marginTop: tokens.spacing.sm,
  },
  backButton: {
    marginTop: tokens.spacing.md,
  },
});
