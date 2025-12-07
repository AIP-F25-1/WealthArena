/**
 * Duolingo-Style Lesson Detail Screen with Slideshow Format
 * Interactive lesson with slides first, then quiz, progress tracking, and rewards
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated, Alert } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Badge, ProgressRing, Icon, tokens } from '@/src/design-system';
import { apiService } from '@/services/apiService';
import { useGamification } from '@/contexts/GamificationContext';

interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

interface LessonQuestion {
  id: string;
  type: 'multiple_choice' | 'fill_blank' | 'matching' | 'true_false' | 'translation';
  question: string;
  options?: QuestionOption[];
  correctAnswer?: string;
  explanation: string;
  difficulty: string;
}

interface Lesson {
  id: string;
  topicId: string;
  title: string;
  description: string;
  content: string;
  questions: LessonQuestion[];
  xpReward: number;
  coinReward: number;
  estimatedDuration: number;
  difficulty: string;
}

const MAX_HEARTS = 5;
const XP_PER_QUESTION = 10;
const COINS_PER_QUESTION = 5;

export default function LessonDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { awardXP, awardCoins, currentXP } = useGamification();
  
  const topicId = params.topicId as string;
  const topicTitle = params.topicTitle as string || 'Learning';
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);

  const totalSteps = slides.length + (lesson?.questions.length || 0);
  const currentStep = showQuiz 
    ? slides.length + currentQuestionIndex + (showExplanation ? 0.5 : 0)
    : currentSlideIndex + 1;
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const scaleAnim = new Animated.Value(1);

  // Load lesson
  useEffect(() => {
    loadLesson();
  }, [topicId]);

  // Generate slides from lesson content
  const generateSlides = (content: string, title: string): string[] => {
    if (!content || content.trim().length === 0) {
      // Generate default slides for the topic
      return [
        `# Welcome to ${title}\n\nIn this lesson, you'll learn the fundamentals of ${title.toLowerCase()}. Let's start with the basics!`,
        `## Key Concepts\n\n• Understanding the core principles\n• Learning practical applications\n• Building your knowledge step by step\n\nReady to dive in?`,
        `## Why This Matters\n\n${title} is essential for successful trading because:\n\n• It helps you make informed decisions\n• Reduces risk in your investments\n• Builds confidence in your trading strategy`,
        `## Let's Practice!\n\nNow that you've learned the basics, it's time to test your knowledge with some questions.\n\n🎯 **Ready for the quiz?**`
      ];
    }

    // Split content into logical sections for slides
    const sections = content.split(/\n\n+/).filter(section => section.trim().length > 0);
    const slidesArray: string[] = [];

    // Welcome slide
    slidesArray.push(`# ${title}\n\nWelcome to this lesson! Let's explore ${title.toLowerCase()} together.`);

    // Content slides (max 4 slides to keep it concise)
    const maxContentSlides = 3;
    const sectionsPerSlide = Math.ceil(sections.length / maxContentSlides);
    
    for (let i = 0; i < maxContentSlides && i * sectionsPerSlide < sections.length; i++) {
      const slideContent = sections
        .slice(i * sectionsPerSlide, (i + 1) * sectionsPerSlide)
        .join('\n\n');
      
      slidesArray.push(`## Slide ${i + 2}\n\n${slideContent}`);
    }

    // Quiz transition slide
    slidesArray.push(`## Ready to Test Your Knowledge?\n\nGreat job learning about ${title}!\n\nNow let's see how much you've absorbed with a quick quiz.\n\n🎯 **Let's start the quiz!**`);

    return slidesArray;
  };

  const loadLesson = async () => {
    try {
      setIsLoading(true);
      
      // Try backend API first (if topicId is numeric, it's from backend)
      if (!isNaN(Number(topicId))) {
        try {
          const response = await apiService.getLearningTopic(topicId);
          if (response.success && response.data) {
            const topicData = response.data;
            if (topicData.lessons && Array.isArray(topicData.lessons) && topicData.lessons.length > 0) {
              // Convert backend lesson format to frontend format
              const backendLesson = topicData.lessons[0];
              const convertedLesson: Lesson = {
                id: backendLesson.LessonID?.toString() || backendLesson.lessonId || '1',
                topicId: topicId,
                title: backendLesson.Title || backendLesson.title || topicData.topic?.Title || 'Lesson',
                description: topicData.topic?.Description || '',
                content: backendLesson.Content || backendLesson.content || '',
                questions: [], // Backend lessons don't have questions yet, will use chatbot for that
                xpReward: backendLesson.XPReward || backendLesson.xpReward || 10,
                coinReward: backendLesson.CoinReward || backendLesson.coinReward || 5,
                estimatedDuration: backendLesson.Duration || 5,
                difficulty: topicData.topic?.Difficulty || 'beginner',
              };
              setLesson(convertedLesson);
              setSlides(generateSlides(convertedLesson.content, convertedLesson.title));
              return;
            }
          }
        } catch (backendError) {
          console.warn('Backend lesson API failed, trying chatbot:', backendError);
        }
      }
      
      // Fallback: Try chatbot API (generates with Groq AI)
      const chatbotUrl = process.env.EXPO_PUBLIC_CHATBOT_URL || 'http://localhost:8000';
      const response = await fetch(
        `${chatbotUrl}/v1/lessons/topic/${topicId}?difficulty=beginner`
      );
      
      if (response.ok) {
        const lessons = await response.json() as any;
        if (lessons && Array.isArray(lessons) && lessons.length > 0) {
          // Convert chatbot lesson format to frontend format
          const chatbotLesson = lessons[0];
          const convertedLesson: Lesson = {
            id: chatbotLesson.id || '1',
            topicId: chatbotLesson.topic_id || topicId,
            title: chatbotLesson.title || 'Lesson',
            description: chatbotLesson.content?.introduction || '',
            content: chatbotLesson.content?.sections?.map((s: any) => `${s.heading}\n${s.body}`).join('\n\n') || '',
            questions: chatbotLesson.content?.quiz?.map((q: any) => ({
              id: q.id,
              type: q.type === 'mcq' ? 'multiple_choice' : q.type === 'fill_in_blank' ? 'fill_blank' : q.type === 'true_false' ? 'true_false' : 'multiple_choice',
              question: q.question_text,
              options: q.options?.map((opt: any) => ({ text: opt.text, isCorrect: opt.is_correct })) || [],
              correctAnswer: q.correct_answer,
              explanation: q.explanation,
              difficulty: chatbotLesson.difficulty || 'beginner',
            })) || [],
            xpReward: chatbotLesson.xp_reward || 10,
            coinReward: chatbotLesson.coin_reward || 5,
            estimatedDuration: 5,
            difficulty: chatbotLesson.difficulty || 'beginner',
          };
          // If lesson has no questions, create default questions
          if (convertedLesson.questions.length === 0) {
            convertedLesson.questions = generateDefaultQuestions(topicTitle);
          }
          setLesson(convertedLesson);
          setSlides(generateSlides(convertedLesson.content, convertedLesson.title));
        } else if (lessons && !Array.isArray(lessons) && lessons.id) {
          // Handle single lesson object
          const singleLesson = lessons as Lesson;
          if (singleLesson.questions.length === 0) {
            singleLesson.questions = generateDefaultQuestions(topicTitle);
          }
          setLesson(singleLesson);
          setSlides(generateSlides(singleLesson.content, singleLesson.title));
        } else {
          // Create a default lesson with sample questions
          const defaultLesson: Lesson = {
            id: 'default-1',
            topicId: topicId,
            title: topicTitle || 'Learning Lesson',
            description: 'Learn the fundamentals of trading',
            content: `Welcome to ${topicTitle || 'this lesson'}! This lesson will teach you the basics.`,
            questions: generateDefaultQuestions(topicTitle),
            xpReward: 50,
            coinReward: 25,
            estimatedDuration: 5,
            difficulty: 'beginner',
          };
          setLesson(defaultLesson);
          setSlides(generateSlides(defaultLesson.content, defaultLesson.title));
        }
      } else {
        // Create a default lesson if API fails
        const defaultLesson: Lesson = {
          id: 'default-1',
          topicId: topicId,
          title: topicTitle || 'Learning Lesson',
          description: 'Learn the fundamentals of trading',
          content: `Welcome to ${topicTitle || 'this lesson'}! This lesson will teach you the basics.`,
          questions: generateDefaultQuestions(topicTitle),
          xpReward: 50,
          coinReward: 25,
          estimatedDuration: 5,
          difficulty: 'beginner',
        };
        setLesson(defaultLesson);
        setSlides(generateSlides(defaultLesson.content, defaultLesson.title));
      }
    } catch (error) {
      console.error('Failed to load lesson:', error);
      // Create a default lesson if API fails
      const defaultLesson: Lesson = {
        id: 'default-1',
        topicId: topicId,
        title: topicTitle || 'Learning Lesson',
        description: 'Learn the fundamentals of trading',
        content: `Welcome to ${topicTitle || 'this lesson'}! This lesson will teach you the basics.`,
        questions: generateDefaultQuestions(topicTitle),
        xpReward: 50,
        coinReward: 25,
        estimatedDuration: 5,
        difficulty: 'beginner',
      };
      setLesson(defaultLesson);
      setSlides(generateSlides(defaultLesson.content, defaultLesson.title));
    } finally {
      setIsLoading(false);
    }
  };

  // Generate default questions for a topic
  const generateDefaultQuestions = (topicTitle: string): LessonQuestion[] => {
    const topicLower = (topicTitle || '').toLowerCase();
    
    // Default questions based on topic
    const defaultQuestions: LessonQuestion[] = [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: `What is the primary goal of ${topicTitle || 'trading'}?`,
        options: [
          { text: 'To make quick profits', isCorrect: false },
          { text: 'To manage risk and grow wealth over time', isCorrect: true },
          { text: 'To trade as frequently as possible', isCorrect: false },
          { text: 'To follow every market trend', isCorrect: false },
        ],
        explanation: 'The primary goal of trading is to manage risk while growing wealth over time, not just making quick profits.',
        difficulty: 'beginner',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        question: 'What is risk management in trading?',
        options: [
          { text: 'Avoiding all risks', isCorrect: false },
          { text: 'Managing potential losses through strategies like stop-loss orders', isCorrect: true },
          { text: 'Only trading when you are sure you will win', isCorrect: false },
          { text: 'Ignoring market volatility', isCorrect: false },
        ],
        explanation: 'Risk management involves using strategies like stop-loss orders to limit potential losses, not avoiding all risks.',
        difficulty: 'beginner',
      },
      {
        id: 'q3',
        type: 'true_false',
        question: 'Diversification helps reduce portfolio risk.',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ],
        explanation: 'True! Diversification spreads risk across different assets, reducing the impact of any single investment performing poorly.',
        difficulty: 'beginner',
      },
    ];
    
    return defaultQuestions;
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    } else {
      // Finished slides, start quiz
      setShowQuiz(true);
    }
  };

  const handlePreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (showExplanation) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!lesson || !selectedAnswer) return;
    
    const currentQuestion = lesson.questions[currentQuestionIndex];
    const isCorrect = checkAnswer(currentQuestion, selectedAnswer);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setEarnedXP(prev => prev + XP_PER_QUESTION);
      setEarnedCoins(prev => prev + COINS_PER_QUESTION);
      
      // Animate success
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      setHearts(prev => Math.max(0, prev - 1));
      
      if (hearts <= 1) {
        // Game over
        handleLessonComplete(false);
        return;
      }
    }
    
    setShowExplanation(true);
  };

  const checkAnswer = (question: LessonQuestion, answer: string): boolean => {
    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      const option = question.options?.find(opt => opt.text === answer);
      return option?.isCorrect || false;
    }
    return answer.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
  };

  const handleNextQuestion = () => {
    if (!lesson) return;
    
    if (currentQuestionIndex < lesson.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      handleLessonComplete(true);
    }
  };

  const handleLessonComplete = async (success: boolean) => {
    setCompleted(true);
    
    if (success && earnedXP > 0) {
      try {
        await awardXP(earnedXP, `Completed lesson: ${lesson?.title}`);
        await awardCoins(earnedCoins, `Completed lesson: ${lesson?.title}`);
        
        // Mark lesson as completed in backend
        if (lesson) {
          try {
            // Try backend API first (if lesson ID is numeric)
            if (!isNaN(Number(lesson.id))) {
              await apiService.completeLearningLesson(Number(lesson.id));
            } else {
              // Fallback to user lesson completion API
              await apiService.completeUserLesson({
                lessonId: lesson.id,
                topicId: lesson.topicId,
                timeSpent: lesson.estimatedDuration * 60,
                score: Math.round((score / (lesson.questions.length || 1)) * 100)
              });
            }
          } catch (error) {
            console.error('Failed to mark lesson as completed:', error);
            // Don't block UI if completion fails
          }
        }
      } catch (error) {
        console.error('Failed to award rewards:', error);
      }
    }
  };

  const currentQuestion = lesson?.questions[currentQuestionIndex];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text variant="h3" weight="semibold" style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
          <Text variant="h3" style={{ color: theme.text }}>Loading lesson...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lesson) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text variant="h3" weight="semibold" style={styles.headerTitle}>Lesson Not Found</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
          <Text variant="h3" style={{ color: theme.text }}>Lesson not found</Text>
          <Button onPress={() => router.back()}>Go Back</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (completed) {
    const success = hearts > 0;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={styles.completionContainer}>
          <View style={[styles.completionIcon, { backgroundColor: success ? theme.success + '20' : theme.danger + '20' }]}>
            <Ionicons 
              name={success ? "trophy" : "close-circle"} 
              size={80} 
              color={success ? theme.success : theme.danger} 
            />
          </View>
          
          <Text variant="h1" weight="bold" center>
            {success ? 'Lesson Complete!' : 'Lesson Failed'}
          </Text>
          
          <Text variant="body" center muted>
            {success 
              ? `You earned ${earnedXP} XP and ${earnedCoins} coins!`
              : 'You ran out of hearts. Try again!'}
          </Text>
          
          <Card style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text variant="small" muted>Score</Text>
              <Text variant="h3" weight="bold">{score}/{lesson.questions.length}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="small" muted>XP Earned</Text>
              <Text variant="h3" weight="bold" color={theme.primary}>{earnedXP}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="small" muted>Coins</Text>
              <Text variant="h3" weight="bold" color={theme.yellow}>{earnedCoins}</Text>
            </View>
          </Card>
          
          <View style={styles.completionActions}>
            <Button
              variant="primary"
              size="large"
              onPress={() => router.back()}
              fullWidth
            >
              Continue Learning
            </Button>
            {!success && (
              <Button
                variant="secondary"
                size="medium"
                onPress={() => {
                  setHearts(MAX_HEARTS);
                  setCurrentSlideIndex(0);
                  setShowQuiz(false);
                  setCurrentQuestionIndex(0);
                  setSelectedAnswer(null);
                  setShowExplanation(false);
                  setScore(0);
                  setEarnedXP(0);
                  setEarnedCoins(0);
                  setCompleted(false);
                }}
                fullWidth
              >
                Try Again
              </Button>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text variant="small" style={{ color: theme.muted }}>{topicTitle}</Text>
          <Text variant="h3" weight="semibold" style={{ color: theme.text }}>{lesson.title}</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Hearts */}
          <View style={styles.heartsContainer}>
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < hearts ? "heart" : "heart-outline"}
                size={20}
                color={i < hearts ? theme.danger : theme.border}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                backgroundColor: theme.primary, 
                width: `${progress}%` 
              }
            ]} 
          />
        </View>
        <Text variant="xs" muted>
          {showQuiz 
            ? `Quiz: ${currentQuestionIndex + 1} / ${lesson.questions.length}`
            : `Slide: ${currentSlideIndex + 1} / ${slides.length}`
          }
        </Text>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Slideshow Mode */}
        {!showQuiz && slides.length > 0 && (
          <Card style={styles.slideCard} elevation="med">
            <View style={styles.slideHeader}>
              <Icon name="presentation" size={24} color={theme.primary} />
              <Text variant="h3" weight="semibold" style={{ marginLeft: tokens.spacing.sm, color: theme.text }}>
                📖 Learning Content
              </Text>
              <View style={styles.slideCounter}>
                <Text variant="xs" muted>
                  {currentSlideIndex + 1} of {slides.length}
                </Text>
              </View>
            </View>
            
            <View style={styles.slideContent}>
              <Text variant="body" style={{ lineHeight: 24, color: theme.text }}>
                {slides[currentSlideIndex]?.split('\n').map((line, index) => {
                  if (line.startsWith('# ')) {
                    return (
                      <Text key={index} variant="h2" weight="bold" style={{ marginBottom: tokens.spacing.md, color: theme.primary }}>
                        {line.substring(2)}{'\n'}
                      </Text>
                    );
                  } else if (line.startsWith('## ')) {
                    return (
                      <Text key={index} variant="h3" weight="semibold" style={{ marginBottom: tokens.spacing.sm, marginTop: tokens.spacing.md, color: theme.text }}>
                        {line.substring(3)}{'\n'}
                      </Text>
                    );
                  } else if (line.startsWith('• ')) {
                    return (
                      <Text key={index} variant="body" style={{ marginLeft: tokens.spacing.md, marginBottom: tokens.spacing.xs, color: theme.text }}>
                        {line}{'\n'}
                      </Text>
                    );
                  } else if (line.trim().length > 0) {
                    return (
                      <Text key={index} variant="body" style={{ marginBottom: tokens.spacing.sm, color: theme.text }}>
                        {line}{'\n'}
                      </Text>
                    );
                  }
                  return <Text key={index}>{'\n'}</Text>;
                })}
              </Text>
            </View>

            <View style={styles.slideNavigation}>
              <Button
                variant="ghost"
                size="medium"
                onPress={handlePreviousSlide}
                disabled={currentSlideIndex === 0}
                style={[styles.slideNavButton, currentSlideIndex === 0 && { opacity: 0.5 }]}
              >
                ← Previous
              </Button>
              
              <View style={styles.slideIndicators}>
                {slides.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.slideIndicator,
                      {
                        backgroundColor: index === currentSlideIndex ? theme.primary : theme.border,
                      }
                    ]}
                  />
                ))}
              </View>

              <Button
                variant="primary"
                size="medium"
                onPress={handleNextSlide}
                style={styles.slideNavButton}
              >
                {currentSlideIndex === slides.length - 1 ? 'Start Quiz →' : 'Next →'}
              </Button>
            </View>
          </Card>
        )}
        
        {/* Quiz Mode */}
        {showQuiz && (
          <>
            {/* Quiz Header */}
            <Card style={styles.quizHeaderCard} elevation="low">
              <View style={styles.quizHeader}>
                <Icon name="quiz" size={24} color={theme.accent} />
                <Text variant="h3" weight="semibold" style={{ marginLeft: tokens.spacing.sm, color: theme.text }}>
                  🎯 Quiz Time!
                </Text>
              </View>
              <Text variant="small" muted>
                Test your knowledge with these questions
              </Text>
            </Card>

            {/* Progress Indicator */}
            <View style={styles.progressIndicator}>
              <Text variant="xs" muted>
                Question {currentQuestionIndex + 1} of {lesson.questions.length}
              </Text>
              <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      backgroundColor: theme.accent, 
                      width: `${((currentQuestionIndex + 1) / lesson.questions.length) * 100}%` 
                    }
                  ]} 
                />
              </View>
            </View>

            {/* Question */}
            {currentQuestion && (
              <Card style={styles.questionCard}>
                <Text variant="h3" weight="semibold" style={styles.questionText}>
                  {currentQuestion.question}
                </Text>

                {/* Multiple Choice / True False */}
                {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false') && (
                  <View style={styles.optionsContainer}>
                    {currentQuestion.options?.map((option, index) => {
                      const isSelected = selectedAnswer === option.text;
                      const isCorrect = option.isCorrect;
                      const showResult = showExplanation;
                      
                      let bgColor = theme.surface;
                      let borderColor = theme.border;
                      let textColor = theme.text;
                      
                      if (showResult) {
                        if (isCorrect) {
                          bgColor = theme.success + '20';
                          borderColor = theme.success;
                        } else if (isSelected && !isCorrect) {
                          bgColor = theme.danger + '20';
                          borderColor = theme.danger;
                        }
                      } else if (isSelected) {
                        bgColor = theme.primary + '20';
                        borderColor = theme.primary;
                      }
                      
                      return (
                        <Pressable
                          key={index}
                          onPress={() => handleAnswerSelect(option.text)}
                          disabled={showExplanation}
                          style={[
                            styles.optionButton,
                            {
                              backgroundColor: bgColor,
                              borderColor: borderColor,
                            }
                          ]}
                        >
                          <Text 
                            variant="body" 
                            style={{ color: textColor }}
                            weight={isSelected ? "semibold" : "regular"}
                          >
                            {option.text}
                          </Text>
                          {showResult && isCorrect && (
                            <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                          )}
                          {showResult && isSelected && !isCorrect && (
                            <Ionicons name="close-circle" size={24} color={theme.danger} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Fill in the Blank */}
                {currentQuestion.type === 'fill_blank' && (
                  <View style={styles.fillBlankContainer}>
                    <Text variant="body" style={styles.fillBlankText}>
                      {currentQuestion.question.split('___').map((part, i, arr) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <Text style={[styles.blankInput, { borderColor: theme.primary }]}>
                              {selectedAnswer || '______'}
                            </Text>
                          )}
                        </React.Fragment>
                      ))}
                    </Text>
                    {!showExplanation && (
                      <View style={styles.fillBlankOptions}>
                        {currentQuestion.options?.map((option, index) => (
                          <Pressable
                            key={index}
                            onPress={() => handleAnswerSelect(option.text)}
                            style={[
                              styles.fillBlankOption,
                              {
                                backgroundColor: selectedAnswer === option.text ? theme.primary + '20' : theme.surface,
                                borderColor: selectedAnswer === option.text ? theme.primary : theme.border,
                              }
                            ]}
                          >
                            <Text variant="body">{option.text}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Explanation */}
                {showExplanation && (
                  <Animated.View style={[styles.explanationCard, { transform: [{ scale: scaleAnim }] }]}>
                    <View style={[styles.explanationHeader, { backgroundColor: checkAnswer(currentQuestion, selectedAnswer || '') ? theme.success + '20' : theme.danger + '20' }]}>
                      <Ionicons 
                        name={checkAnswer(currentQuestion, selectedAnswer || '') ? "checkmark-circle" : "close-circle"} 
                        size={24} 
                        color={checkAnswer(currentQuestion, selectedAnswer || '') ? theme.success : theme.danger} 
                      />
                      <Text 
                        variant="body" 
                        weight="semibold"
                        color={checkAnswer(currentQuestion, selectedAnswer || '') ? theme.success : theme.danger}
                      >
                        {checkAnswer(currentQuestion, selectedAnswer || '') ? 'Correct!' : 'Incorrect'}
                      </Text>
                    </View>
                    <Text variant="small" style={styles.explanationText}>
                      {currentQuestion.explanation}
                    </Text>
                  </Animated.View>
                )}
              </Card>
            )}

            {/* Quiz Action Button */}
            <View style={styles.actionContainer}>
              {!showExplanation ? (
                <Button
                  variant="primary"
                  size="large"
                  onPress={handleSubmitAnswer}
                  disabled={!selectedAnswer}
                  fullWidth
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="large"
                  onPress={handleNextQuestion}
                  fullWidth
                  icon={<Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
                >
                  {currentQuestionIndex < lesson.questions.length - 1 ? 'Continue' : 'Complete Lesson'}
                </Button>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: tokens.spacing.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: tokens.spacing.md,
  },
  headerRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  heartsContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  progressIndicator: {
    marginBottom: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  questionCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  questionText: {
    marginBottom: tokens.spacing.sm,
  },
  optionsContainer: {
    gap: tokens.spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 2,
  },
  fillBlankContainer: {
    gap: tokens.spacing.md,
  },
  fillBlankText: {
    lineHeight: 32,
  },
  blankInput: {
    borderBottomWidth: 2,
    paddingHorizontal: tokens.spacing.sm,
    minWidth: 100,
    textAlign: 'center',
  },
  fillBlankOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  fillBlankOption: {
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
  },
  explanationCard: {
    marginTop: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: 'transparent',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
    marginBottom: tokens.spacing.sm,
  },
  explanationText: {
    lineHeight: 22,
  },
  actionContainer: {
    paddingBottom: tokens.spacing.xl,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  completionIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    width: '100%',
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completionActions: {
    width: '100%',
    gap: tokens.spacing.sm,
  },
  // Slideshow styles
  slideCard: {
    padding: tokens.spacing.lg,
    minHeight: 400,
    gap: tokens.spacing.md,
  },
  slideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  slideCounter: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: tokens.spacing.lg,
  },
  slideNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  slideNavButton: {
    minWidth: 100,
  },
  slideIndicators: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  slideIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Quiz styles
  quizHeaderCard: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
