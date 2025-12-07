import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, Icon, Badge, ProgressRing, FAB, tokens } from '@/src/design-system';
import { apiService } from '@/services/apiService';
import { useGamification } from '@/contexts/GamificationContext';

// Fallback topics - only used when both APIs fail
// All progress values set to 0 as these should only be used as absolute fallback
const TOPICS = [
  { id: '1', title: 'Start Here', icon: 'trophy', completed: false, lessons: 5, progress: 0 },
  { id: '2', title: 'Investing Basics', icon: 'market', completed: false, lessons: 8, progress: 0 },
  { id: '3', title: 'Investing Strategies', icon: 'lab', completed: false, lessons: 12, progress: 0 },
  { id: '4', title: 'Portfolio Management', icon: 'portfolio', completed: false, lessons: 10, progress: 0 },
  { id: '5', title: 'Risk Analysis', icon: 'shield', completed: false, lessons: 7, progress: 0 },
  { id: '6', title: 'Technical Analysis', icon: 'signal', completed: false, lessons: 15, progress: 0 },
  { id: '7', title: 'Market Psychology', icon: 'agent', completed: false, lessons: 6, progress: 0 },
];

export default function LearningTopicsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { currentXP, currentLevel } = useGamification();
  const [topics, setTopics] = useState(TOPICS);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [learningProgress, setLearningProgress] = useState<any>(null);

  // Valid icon names from design-system Icon component
  const validIcons = [
    'market', 'signal', 'agent', 'replay', 'portfolio', 'shield', 'execute',
    'trophy', 'leaderboard', 'news', 'check-shield', 'lab', 'alert', 'settings',
    'send', 'google', 'bell', 'coin', 'xp', 'game-controller', 'robot'
  ];

  // Helper function to map category to icon (with validation)
  const getCategoryIcon = (category: string) => {
    const iconMap: { [key: string]: string } = {
      'Technical Analysis': 'signal',
      'Risk Management': 'shield',
      'Portfolio Management': 'portfolio',
      'Market Analysis': 'market',
      'Trading Strategies': 'lab',
      'Trading Psychology': 'agent',
      'Fundamentals': 'portfolio', // Changed from 'document-text' (doesn't exist)
      'Options': 'signal', // Changed from 'options' (doesn't exist)
      'Futures': 'signal', // Changed from 'time' (doesn't exist)  
      'Crypto': 'market', // Changed from 'logo-bitcoin' (doesn't exist)
    };
    
    const iconName = iconMap[category] || 'trophy';
    
    // Validate icon name against valid icons
    if (validIcons.includes(iconName)) {
      return iconName;
    }
    
    // Fallback to valid icon
    return 'trophy';
  };

  // Helper function to map difficulty to lesson count
  const getDifficultyLessons = (difficulty: string) => {
    const lessonMap: { [key: string]: number } = {
      'beginner': 5,
      'intermediate': 10,
      'advanced': 15,
    };
    return lessonMap[difficulty?.toLowerCase()] || 10;
  };

  // Load real learning data from backend
  useEffect(() => {
    const loadLearningData = async () => {
      try {
        setIsLoading(true);
        
        // Try backend learning API first (primary source)
        try {
          const response = await apiService.getLearningTopics();
          console.log('Backend learning API response:', response);
          console.log('Backend learning API response structure:', {
            success: response?.success,
            hasData: !!response?.data,
            isArray: Array.isArray(response?.data),
            dataLength: Array.isArray(response?.data) ? response.data.length : 0,
            fullResponse: response,
          });
          
          if (response && response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            // Map backend response to UI format
            const mappedTopics = response.data.map((topic: any) => ({
              id: topic.TopicID?.toString() || topic.topicId || `topic_${Date.now()}_${Math.random()}`,
              title: topic.Title || topic.title || 'Untitled Topic',
              icon: getCategoryIcon(topic.category || topic.Difficulty || 'Fundamentals'),
              completed: topic.IsCompleted || topic.isCompleted || false,
              lessons: topic.EstimatedDuration || getDifficultyLessons(topic.Difficulty || topic.difficulty || 'beginner'),
              progress: topic.Progress || topic.progress || 0,
              description: topic.Description || topic.description,
              difficulty: topic.Difficulty || topic.difficulty || 'beginner',
              xpReward: topic.XPReward || topic.xpReward || 0,
              coinReward: topic.CoinReward || topic.coinReward || 0,
            }));
            
            console.log('Mapped topics from backend:', mappedTopics);
            setTopics(mappedTopics);
            
            // Load overall progress
            try {
              const progressData = await apiService.getUserLearningProgress();
              setLearningProgress(progressData);
            } catch (progressError) {
              console.log('Learning progress not available yet');
            }
            
            setIsLoading(false);
            return; // Success, exit early
          } else {
            console.log('Backend returned empty or invalid data, trying chatbot...');
          }
        } catch (backendError: any) {
          console.warn('Backend learning API failed:', backendError?.message || backendError);
        }
        
        // Fallback: Try chatbot API
        try {
          const chatbotResponse = await apiService.getKnowledgeTopics();
          console.log('Chatbot API response:', chatbotResponse);
          
          // Chatbot API returns { topics: [...], total: ..., categories: [...] }
          let topicsArray: any[] = [];
          if (chatbotResponse && chatbotResponse.topics && Array.isArray(chatbotResponse.topics)) {
            topicsArray = chatbotResponse.topics;
          } else if (Array.isArray(chatbotResponse)) {
            topicsArray = chatbotResponse;
          }
          
          if (topicsArray.length > 0) {
            const mappedTopics = topicsArray.map((topic: any) => ({
              id: topic.id || topic.topicId || topic.topic_id || `topic_${Date.now()}_${Math.random()}`,
              title: topic.name || topic.title || 'Untitled Topic',
              icon: getCategoryIcon(topic.category || 'Fundamentals'),
              completed: false,
              lessons: getDifficultyLessons(topic.difficulty || 'beginner'),
              progress: 0,
              description: topic.description || '',
              difficulty: topic.difficulty || 'beginner',
            }));
            console.log('Mapped topics from chatbot:', mappedTopics);
            setTopics(mappedTopics);
            setIsLoading(false);
            return;
          } else {
            console.log('Chatbot returned empty topics array');
          }
        } catch (chatbotError: any) {
          console.warn('Chatbot API also failed:', chatbotError?.message || chatbotError);
        }
        
        // If both APIs fail, use default TOPICS (this ensures the page always shows something)
        console.log('Using default topics as fallback');
        setTopics(TOPICS);
        
      } catch (error: any) {
        console.error('Failed to load learning data:', error?.message || error);
        // On error, still show default topics so page isn't broken
        setTopics(TOPICS);
      } finally {
        setIsLoading(false);
      }
    };

    loadLearningData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Try backend API first
      try {
        const response = await apiService.getLearningTopics();
        if (response && response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
          const mappedTopics = response.data.map((topic: any) => ({
            id: topic.TopicID?.toString() || topic.topicId,
            title: topic.Title || topic.title,
            icon: getCategoryIcon(topic.category || topic.Difficulty || 'Fundamentals'),
            completed: topic.IsCompleted || false,
            lessons: topic.EstimatedDuration || getDifficultyLessons(topic.Difficulty || 'beginner'),
            progress: topic.Progress || 0,
            description: topic.Description || topic.description,
            difficulty: topic.Difficulty || topic.difficulty || 'beginner',
            xpReward: topic.XPReward || topic.xpReward || 0,
            coinReward: topic.CoinReward || topic.coinReward || 0,
          }));
          setTopics(mappedTopics);
          
          try {
            const progressData = await apiService.getUserLearningProgress();
            setLearningProgress(progressData);
          } catch (progressError) {
            console.log('Progress not available');
          }
          setRefreshing(false);
          return;
        }
      } catch (backendError: any) {
        console.warn('Backend refresh failed, trying chatbot:', backendError?.message || backendError);
      }
      
      // Fallback to chatbot
      try {
        const chatbotResponse = await apiService.getKnowledgeTopics();
        let topicsArray: any[] = [];
        if (chatbotResponse && chatbotResponse.topics && Array.isArray(chatbotResponse.topics)) {
          topicsArray = chatbotResponse.topics;
        } else if (Array.isArray(chatbotResponse)) {
          topicsArray = chatbotResponse;
        }
        
        if (topicsArray.length > 0) {
          const mappedTopics = topicsArray.map((topic: any) => ({
            id: topic.id || topic.topicId,
            title: topic.name || topic.title,
            icon: getCategoryIcon(topic.category || 'Fundamentals'),
            completed: false,
            lessons: getDifficultyLessons(topic.difficulty || 'beginner'),
            progress: 0,
            description: topic.description || '',
            difficulty: topic.difficulty || 'beginner',
          }));
          setTopics(mappedTopics);
        } else {
          setTopics(TOPICS); // Fallback to defaults
        }
      } catch (chatbotError: any) {
        console.warn('Chatbot refresh failed:', chatbotError?.message || chatbotError);
        setTopics(TOPICS); // Fallback to defaults
      }
    } catch (error: any) {
      console.error('Failed to refresh learning data:', error?.message || error);
      setTopics(TOPICS); // Fallback to defaults
    } finally {
      setRefreshing(false);
    }
  };

  const totalLessons = topics.reduce((sum, t) => sum + t.lessons, 0);
  const completedLessons = topics.reduce((sum, t) => sum + Math.floor(t.lessons * t.progress / 100), 0);
  const overallProgress = (completedLessons / totalLessons) * 100;

  // Handle topic selection - route to lesson detail screen
  const handleTopicPress = (topic: any) => {
    router.push(`/lesson-detail?topicId=${topic.id}&topicTitle=${encodeURIComponent(topic.title)}`);
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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Learning</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.primary} />
        </Pressable>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <Card style={styles.headerCard} elevation="med">
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Icon name="trophy" size={32} color={theme.yellow} />
              <View>
                <Text variant="h2" weight="bold">Learning Path</Text>
                <Text variant="small" muted>
                  {completedLessons} of {totalLessons} lessons completed
                </Text>
              </View>
            </View>
            <ProgressRing progress={overallProgress} size={60} showLabel={false} />
          </View>
        </Card>

        {/* Topics List */}
        {isLoading ? (
          <Card style={styles.topicCard}>
            <View style={styles.loadingContainer}>
              <Text variant="body" muted center>Loading topics...</Text>
            </View>
          </Card>
        ) : topics.length === 0 ? (
          <Card style={styles.topicCard}>
            <View style={styles.emptyContainer}>
              <Icon name="trophy" size={48} color={theme.muted} />
              <Text variant="h3" weight="semibold" center style={{ marginTop: tokens.spacing.md }}>
                No Topics Available
              </Text>
              <Text variant="small" muted center style={{ marginTop: tokens.spacing.sm }}>
                Learning topics will appear here once they're available.
              </Text>
              <Button 
                variant="primary" 
                size="medium" 
                onPress={onRefresh}
                style={{ marginTop: tokens.spacing.md }}
              >
                Refresh
              </Button>
            </View>
          </Card>
        ) : (
          topics.map((topic) => (
            <Pressable 
              key={topic.id}
              onPress={() => handleTopicPress(topic)}
            >
              <Card style={styles.topicCard} elevation="low">
                <View style={styles.topicHeader}>
                  <View style={[
                    styles.iconCircle, 
                    { 
                      backgroundColor: topic.completed 
                        ? theme.success + '20' 
                        : topic.progress > 0 
                        ? theme.primary + '20' 
                        : theme.surface 
                    }
                  ]}>
                    <Icon 
                      name={topic.icon as any} 
                      size={28} 
                      color={topic.completed ? theme.success : theme.primary} 
                    />
                  </View>
                  <View style={styles.topicInfo}>
                    <View style={styles.topicTitleRow}>
                      <Text variant="body" weight="semibold">{topic.title}</Text>
                      {topic.completed && (
                        <Badge variant="success" size="small">
                          <Icon name="check-shield" size={12} color="#FFFFFF" />
                        </Badge>
                      )}
                    </View>
                    <Text variant="small" muted>
                      {topic.lessons} lessons
                      {topic.progress > 0 && ` • ${topic.progress}% complete`}
                      {topic.difficulty && ` • ${topic.difficulty}`}
                    </Text>
                    {topic.description && (
                      <Text variant="xs" muted style={{ marginTop: tokens.spacing.xs }}>
                        {topic.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={theme.muted} 
                  />
                </View>

                {/* Progress Bar */}
                {topic.progress > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                      <View 
                        style={[
                          styles.progressFill,
                          { 
                            backgroundColor: topic.completed ? theme.success : theme.primary, 
                            width: `${topic.progress}%` 
                          }
                        ]} 
                      />
                    </View>
                    <Text variant="xs" muted>{topic.progress}%</Text>
                  </View>
                )}

                {/* Rewards Preview */}
                {(topic.xpReward || topic.coinReward) && (
                  <View style={styles.rewardsPreview}>
                    {topic.xpReward > 0 && (
                      <View style={[styles.rewardBadge, { backgroundColor: theme.surface }]}>
                        <Icon name="xp" size={14} color={theme.primary} />
                        <Text variant="xs" muted>{topic.xpReward} XP</Text>
                      </View>
                    )}
                    {topic.coinReward > 0 && (
                      <View style={[styles.rewardBadge, { backgroundColor: theme.surface }]}>
                        <Icon name="coin" size={14} color={theme.yellow} />
                        <Text variant="xs" muted>{topic.coinReward} Coins</Text>
                      </View>
                    )}
                  </View>
                )}

                {topic.progress === 0 && !topic.completed && (
                  <Button 
                    variant="primary" 
                    size="small" 
                    style={{ marginTop: tokens.spacing.sm }}
                    onPress={() => handleTopicPress(topic)}
                  >
                    Start Learning
                  </Button>
                )}
              </Card>
            </Pressable>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
      
      <FAB onPress={() => router.push('/ai-chat')} />
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
  refreshButton: {
    padding: tokens.spacing.xs,
    marginRight: -tokens.spacing.xs,
  },
  scrollView: { flex: 1 },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {},
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    flex: 1,
  },
  topicCard: {
    gap: tokens.spacing.sm,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicInfo: {
    flex: 1,
    gap: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  loadingContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  rewardsPreview: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
  },
});
