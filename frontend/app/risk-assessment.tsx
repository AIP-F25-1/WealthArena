/**
 * Risk Assessment Questionnaire
 * Comprehensive risk tolerance assessment for personalized recommendations
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, tokens, ProgressRing } from '@/src/design-system';
import { useUserSettings } from '@/contexts/UserSettingsContext';

interface Question {
  id: string;
  question: string;
  options: {
    value: string;
    label: string;
    description?: string;
    score: number;
  }[];
  category: 'risk_tolerance' | 'investment_horizon' | 'volatility' | 'liquidity' | 'esg' | 'sectors';
}

const RISK_QUESTIONS: Question[] = [
  {
    id: 'risk_tolerance_1',
    question: 'How would you describe your investment experience?',
    options: [
      { value: 'beginner', label: 'Beginner', description: 'New to investing', score: 1 },
      { value: 'some_experience', label: 'Some Experience', description: '1-3 years of investing', score: 2 },
      { value: 'experienced', label: 'Experienced', description: '3-10 years of investing', score: 3 },
      { value: 'expert', label: 'Expert', description: '10+ years of investing', score: 4 },
    ],
    category: 'risk_tolerance'
  },
  {
    id: 'risk_tolerance_2',
    question: 'If your portfolio lost 20% in one month, what would you do?',
    options: [
      { value: 'panic_sell', label: 'Sell everything immediately', description: 'Cut losses and exit', score: 1 },
      { value: 'sell_some', label: 'Sell some investments', description: 'Reduce exposure', score: 2 },
      { value: 'hold', label: 'Hold and wait', description: 'Stay the course', score: 3 },
      { value: 'buy_more', label: 'Buy more at lower prices', description: 'See opportunity', score: 4 },
    ],
    category: 'risk_tolerance'
  },
  {
    id: 'investment_horizon',
    question: 'What is your primary investment time horizon?',
    options: [
      { value: 'short', label: 'Less than 2 years', description: 'Short-term goals', score: 1 },
      { value: 'medium', label: '2-5 years', description: 'Medium-term goals', score: 2 },
      { value: 'long', label: '5-10 years', description: 'Long-term growth', score: 3 },
      { value: 'very_long', label: '10+ years', description: 'Retirement planning', score: 4 },
    ],
    category: 'investment_horizon'
  },
  {
    id: 'volatility_1',
    question: 'How comfortable are you with daily price fluctuations?',
    options: [
      { value: 'very_uncomfortable', label: 'Very Uncomfortable', description: 'Prefer stable investments', score: 1 },
      { value: 'somewhat_uncomfortable', label: 'Somewhat Uncomfortable', description: 'Small fluctuations OK', score: 2 },
      { value: 'comfortable', label: 'Comfortable', description: 'Moderate fluctuations fine', score: 3 },
      { value: 'very_comfortable', label: 'Very Comfortable', description: 'High volatility acceptable', score: 4 },
    ],
    category: 'volatility'
  },
  {
    id: 'liquidity_1',
    question: 'How quickly might you need to access your investment funds?',
    options: [
      { value: 'immediately', label: 'Immediately', description: 'Emergency fund needed', score: 1 },
      { value: 'within_month', label: 'Within a month', description: 'Short-term liquidity', score: 2 },
      { value: 'within_year', label: 'Within a year', description: 'Medium-term access', score: 3 },
      { value: 'years', label: 'Several years', description: 'Long-term investment', score: 4 },
    ],
    category: 'liquidity'
  },
  {
    id: 'esg_1',
    question: 'How important are ESG (Environmental, Social, Governance) factors in your investments?',
    options: [
      { value: 'not_important', label: 'Not Important', description: 'Returns are primary focus', score: 1 },
      { value: 'somewhat_important', label: 'Somewhat Important', description: 'Consider if returns similar', score: 2 },
      { value: 'important', label: 'Important', description: 'Significant factor in decisions', score: 3 },
      { value: 'very_important', label: 'Very Important', description: 'Primary consideration', score: 4 },
    ],
    category: 'esg'
  },
  {
    id: 'sectors_1',
    question: 'Which sectors interest you most? (Select all that apply)',
    options: [
      { value: 'technology', label: 'Technology', description: 'Tech stocks and innovation', score: 3 },
      { value: 'healthcare', label: 'Healthcare', description: 'Medical and biotech', score: 2 },
      { value: 'finance', label: 'Financial Services', description: 'Banks and insurance', score: 2 },
      { value: 'energy', label: 'Energy', description: 'Oil, gas, and renewables', score: 2 },
      { value: 'consumer', label: 'Consumer Goods', description: 'Retail and consumer brands', score: 1 },
      { value: 'utilities', label: 'Utilities', description: 'Stable dividend payers', score: 1 },
    ],
    category: 'sectors'
  }
];

export default function RiskAssessmentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { settings, updateRiskProfile } = useUserSettings();
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [riskScore, setRiskScore] = useState(0);

  const question = RISK_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / RISK_QUESTIONS.length) * 100;

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers };
    
    if (question.category === 'sectors') {
      // Multiple selection for sectors
      const currentSectors = newAnswers[question.id] || [];
      if (currentSectors.includes(value)) {
        newAnswers[question.id] = currentSectors.filter(v => v !== value);
      } else {
        newAnswers[question.id] = [...currentSectors, value];
      }
    } else {
      // Single selection for other questions
      newAnswers[question.id] = [value];
    }
    
    setAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestion < RISK_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateRiskProfile();
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateRiskProfile = () => {
    let totalScore = 0;
    let questionCount = 0;
    const sectorPreferences: string[] = [];

    RISK_QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      if (answer && answer.length > 0) {
        if (q.category === 'sectors') {
          sectorPreferences.push(...answer);
        } else {
          const option = q.options.find(opt => opt.value === answer[0]);
          if (option) {
            totalScore += option.score;
            questionCount++;
          }
        }
      }
    });

    const averageScore = questionCount > 0 ? totalScore / questionCount : 2;
    setRiskScore(averageScore);

    // Determine risk tolerance based on score
    let riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
    if (averageScore <= 1.5) riskTolerance = 'conservative';
    else if (averageScore <= 2.5) riskTolerance = 'moderate';
    else if (averageScore <= 3.5) riskTolerance = 'aggressive';
    else riskTolerance = 'very_aggressive';

    // Determine other profile characteristics
    const investmentHorizon = answers['investment_horizon']?.[0] || 'medium';
    const volatilityTolerance = answers['volatility_1']?.[0] || 'medium';
    const liquidityNeeds = answers['liquidity_1']?.[0] || 'medium';
    const esgPreference = answers['esg_1']?.[0] || 'none';

    // Calculate max drawdown based on risk tolerance
    const maxDrawdown = riskTolerance === 'conservative' ? 10 : 
                       riskTolerance === 'moderate' ? 15 : 
                       riskTolerance === 'aggressive' ? 25 : 35;

    // Update risk profile
    updateRiskProfile({
      riskTolerance,
      investmentHorizon: investmentHorizon as 'short' | 'medium' | 'long',
      maxDrawdown,
      volatilityTolerance: volatilityTolerance.includes('uncomfortable') ? 'low' : 
                          volatilityTolerance.includes('comfortable') ? 'high' : 'medium',
      liquidityNeeds: liquidityNeeds.includes('immediately') ? 'high' : 
                     liquidityNeeds.includes('years') ? 'low' : 'medium',
      esgPreference: esgPreference.includes('not') ? 'none' : 
                    esgPreference.includes('somewhat') ? 'moderate' : 'high',
      sectorPreferences,
    });

    setIsComplete(true);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'conservative': return theme.success;
      case 'moderate': return theme.warning;
      case 'aggressive': return theme.danger;
      case 'very_aggressive': return theme.accent;
      default: return theme.muted;
    }
  };

  const getRiskLevelDescription = (level: string) => {
    switch (level) {
      case 'conservative': return 'You prefer stable, low-risk investments with steady returns.';
      case 'moderate': return 'You balance risk and return, comfortable with some volatility.';
      case 'aggressive': return 'You seek higher returns and can handle significant volatility.';
      case 'very_aggressive': return 'You maximize growth potential and accept high risk.';
      default: return '';
    }
  };

  if (isComplete) {
    const riskLevel = settings.riskProfile.riskTolerance;
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
          <Text variant="h3" weight="semibold" style={styles.headerTitle}>Assessment Complete</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Results Header */}
          <Card style={styles.resultsCard} elevation="med" noBorder>
            <LinearGradient
              colors={[getRiskLevelColor(riskLevel), getRiskLevelColor(riskLevel) + '80']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resultsGradient}
            >
              <View style={styles.resultsContent}>
                <Ionicons name="checkmark-circle" size={64} color={theme.bg} />
                <Text variant="h1" weight="bold" style={[styles.resultsTitle, { color: theme.bg }]}>
                  Risk Assessment Complete
                </Text>
                <Text variant="body" style={[styles.resultsSubtitle, { color: theme.bg + 'CC' }]}>
                  Your risk profile has been updated
                </Text>
              </View>
            </LinearGradient>
          </Card>

          {/* Risk Profile Summary */}
          <Card style={styles.summaryCard}>
            <Text variant="h3" weight="semibold" style={styles.sectionTitle}>Your Risk Profile</Text>
            
            <View style={styles.riskLevelCard}>
              <View style={styles.riskLevelHeader}>
                <Badge 
                  variant={riskLevel === 'conservative' ? 'success' : 
                          riskLevel === 'moderate' ? 'warning' : 'danger'}
                  size="large"
                >
                  {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).replace('_', ' ')}
                </Badge>
                <Text variant="h2" weight="bold" color={getRiskLevelColor(riskLevel)}>
                  Risk Score: {riskScore.toFixed(1)}/4.0
                </Text>
              </View>
              <Text variant="body" muted style={styles.riskDescription}>
                {getRiskLevelDescription(riskLevel)}
              </Text>
            </View>

            {/* Profile Details */}
            <View style={styles.profileDetails}>
              <View style={styles.detailItem}>
                <Text variant="small" muted>Investment Horizon</Text>
                <Text variant="body" weight="semibold">
                  {settings.riskProfile.investmentHorizon.charAt(0).toUpperCase() + 
                   settings.riskProfile.investmentHorizon.slice(1)}-term
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="small" muted>Max Drawdown</Text>
                <Text variant="body" weight="semibold">
                  {settings.riskProfile.maxDrawdown}%
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="small" muted>Volatility Tolerance</Text>
                <Text variant="body" weight="semibold">
                  {settings.riskProfile.volatilityTolerance.charAt(0).toUpperCase() + 
                   settings.riskProfile.volatilityTolerance.slice(1)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text variant="small" muted>Liquidity Needs</Text>
                <Text variant="body" weight="semibold">
                  {settings.riskProfile.liquidityNeeds.charAt(0).toUpperCase() + 
                   settings.riskProfile.liquidityNeeds.slice(1)}
                </Text>
              </View>
            </View>

            {settings.riskProfile.sectorPreferences.length > 0 && (
              <View style={styles.sectorsSection}>
                <Text variant="small" muted>Preferred Sectors</Text>
                <View style={styles.sectorTags}>
                  {settings.riskProfile.sectorPreferences.map((sector, index) => (
                    <Badge key={index} variant="secondary" size="small">
                      {sector.charAt(0).toUpperCase() + sector.slice(1)}
                    </Badge>
                  ))}
                </View>
              </View>
            )}
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              variant="secondary"
              size="large"
              onPress={() => router.back()}
              style={styles.actionButton}
            >
              Back to Profile
            </Button>
            <Button
              variant="primary"
              size="large"
              onPress={() => router.push('/portfolio-builder')}
              style={styles.actionButton}
              icon={<Ionicons name="briefcase" size={20} color={theme.bg} />}
            >
              Build Portfolio
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Risk Assessment</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Progress Header */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text variant="h3" weight="semibold">Question {currentQuestion + 1} of {RISK_QUESTIONS.length}</Text>
            <Text variant="small" muted>{Math.round(progress)}% Complete</Text>
          </View>
          <ProgressRing
            progress={progress / 100}
            size={60}
            strokeWidth={6}
            color={theme.primary}
            backgroundColor={theme.border}
          />
        </Card>

        {/* Question Card */}
        <Card style={styles.questionCard}>
          <Text variant="h2" weight="bold" style={styles.questionText}>
            {question.question}
          </Text>
          
          {question.category === 'sectors' && (
            <Text variant="small" muted style={styles.multiSelectHint}>
              Select all that apply
            </Text>
          )}

          <View style={styles.optionsContainer}>
            {question.options.map((option) => {
              const isSelected = answers[question.id]?.includes(option.value) || false;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleAnswer(option.value)}
                  style={[
                    styles.optionCard,
                    isSelected && {
                      borderColor: theme.primary,
                      borderWidth: 2,
                      backgroundColor: theme.primary + '10'
                    }
                  ]}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionText}>
                      <Text variant="body" weight="semibold">{option.label}</Text>
                      {option.description && (
                        <Text variant="small" muted>{option.description}</Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons 
                        name="checkmark-circle" 
                        size={24} 
                        color={theme.primary} 
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          <Button
            variant="secondary"
            size="large"
            onPress={prevQuestion}
            disabled={currentQuestion === 0}
            style={styles.navButton}
          >
            Previous
          </Button>
          <Button
            variant="primary"
            size="large"
            onPress={nextQuestion}
            disabled={!answers[question.id] || answers[question.id].length === 0}
            style={styles.navButton}
          >
            {currentQuestion === RISK_QUESTIONS.length - 1 ? 'Complete' : 'Next'}
          </Button>
        </View>
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
    paddingBottom: tokens.spacing.xl * 2,
  },
  progressCard: {
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  progressHeader: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  questionCard: {
    gap: tokens.spacing.md,
  },
  questionText: {
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  multiSelectHint: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  optionsContainer: {
    gap: tokens.spacing.sm,
  },
  optionCard: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  navButton: {
    flex: 1,
  },
  resultsCard: {
    marginBottom: tokens.spacing.md,
  },
  resultsGradient: {
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
  },
  resultsContent: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  resultsTitle: {
    textAlign: 'center',
  },
  resultsSubtitle: {
    textAlign: 'center',
  },
  summaryCard: {
    gap: tokens.spacing.md,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.sm,
  },
  riskLevelCard: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: tokens.radius.md,
  },
  riskLevelHeader: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  riskDescription: {
    textAlign: 'center',
    lineHeight: 20,
  },
  profileDetails: {
    gap: tokens.spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
  },
  sectorsSection: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  sectorTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
