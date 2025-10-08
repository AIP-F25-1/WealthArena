import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Card, Button, Icon, Badge, ProgressRing, FAB, tokens } from '@/src/design-system';

const TOPICS = [
  { id: '1', title: 'Start Here', icon: 'trophy', completed: false, lessons: 5, progress: 0 },
  { id: '2', title: 'Investing Basics', icon: 'market', completed: false, lessons: 8, progress: 25 },
  { id: '3', title: 'Investing Strategies', icon: 'lab', completed: false, lessons: 12, progress: 0 },
  { id: '4', title: 'Portfolio Management', icon: 'portfolio', completed: false, lessons: 10, progress: 40 },
  { id: '5', title: 'Risk Analysis', icon: 'shield', completed: false, lessons: 7, progress: 0 },
  { id: '6', title: 'Technical Analysis', icon: 'signal', completed: false, lessons: 15, progress: 60 },
  { id: '7', title: 'Market Psychology', icon: 'agent', completed: false, lessons: 6, progress: 0 },
];

export default function LearningTopicsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const totalLessons = TOPICS.reduce((sum, t) => sum + t.lessons, 0);
  const completedLessons = TOPICS.reduce((sum, t) => sum + Math.floor(t.lessons * t.progress / 100), 0);
  const overallProgress = (completedLessons / totalLessons) * 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Learning',
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
        {TOPICS.map((topic) => (
          <Pressable 
            key={topic.id}
            onPress={() => router.push('/daily-quests')}
          >
            <Card style={styles.topicCard}>
              <View style={styles.topicHeader}>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                  <Icon name={topic.icon as any} size={28} color={theme.primary} />
                </View>
                <View style={styles.topicInfo}>
                  <Text variant="body" weight="semibold">{topic.title}</Text>
                  <Text variant="small" muted>
                    {topic.lessons} lessons • {topic.progress}% complete
                  </Text>
                </View>
                {topic.completed && (
                  <Icon name="check-shield" size={24} color={theme.primary} />
                )}
              </View>

              {/* Progress Bar */}
              {topic.progress > 0 && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                    <View 
                      style={[
                        styles.progressFill,
                        { backgroundColor: theme.primary, width: `${topic.progress}%` }
                      ]} 
                    />
                  </View>
                  <Text variant="xs" muted>{topic.progress}%</Text>
                </View>
              )}

              {topic.progress === 0 && (
                <Button variant="secondary" size="small">
                  Start Learning
                </Button>
              )}
            </Card>
          </Pressable>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
      
      <FAB onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
});
