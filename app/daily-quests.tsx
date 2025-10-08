import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  useTheme, 
  Text, 
  Card, 
  Icon, 
  ProgressRing,
  FAB,
  tokens 
} from '@/src/design-system';

// Calculate time remaining until end of day
const getTimeRemaining = () => {
  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const diff = endOfDay.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `${hours} hours`;
};

const QUESTS = [
  {
    id: '1',
    icon: 'trophy',
    title: 'Earn 80 coins',
    subtitle: 'Complete lessons and challenges',
    progress: 25,
    target: 80,
  },
  {
    id: '2',
    icon: 'check-shield',
    title: 'Answer 10 quizzes correctly',
    subtitle: 'Every correct answer earns you a reward',
    progress: 4,
    target: 10,
  },
  {
    id: '3',
    icon: 'market',
    title: 'Review 5 trade signals',
    subtitle: 'Analyze market opportunities',
    progress: 2,
    target: 5,
  },
];

export default function DailyQuestsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const totalProgress = QUESTS.reduce((sum, q) => sum + (q.progress / q.target), 0) / QUESTS.length * 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text variant="h3" weight="bold">Daily Quests</Text>
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={18} color={theme.yellow} />
          <Text variant="small" weight="semibold" color={theme.yellow}>{timeRemaining}</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Overall Progress Card */}
        <Card style={styles.progressCard} elevation="med">
          <View style={styles.progressHeader}>
            <View style={styles.progressInfo}>
              <Text variant="h3" weight="semibold">Today's Progress</Text>
              <Text variant="small" muted>Complete all quests for bonus rewards</Text>
            </View>
            <ProgressRing progress={totalProgress} size={70} />
          </View>
        </Card>

        {/* Quest Cards */}
        {QUESTS.map((quest) => {
          const questProgress = (quest.progress / quest.target) * 100;
          const isComplete = quest.progress >= quest.target;
          
          return (
            <Card key={quest.id} style={styles.questCard}>
              <View style={styles.questHeader}>
                <View style={[
                  styles.iconCircle, 
                  { backgroundColor: isComplete ? theme.primary + '30' : theme.surface }
                ]}>
                  <Icon name={quest.icon as any} size={28} color={isComplete ? theme.primary : theme.text} />
                </View>
                
                <View style={styles.questInfo}>
                  <Text variant="body" weight="semibold">{quest.title}</Text>
                  <Text variant="small" muted>{quest.subtitle}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.progressFill,
                      { 
                        backgroundColor: isComplete ? theme.primary : theme.accent,
                        width: `${questProgress}%` 
                      }
                    ]} 
                  />
                </View>
                <Text variant="small" weight="semibold">
                  {quest.progress}/{quest.target}
                </Text>
              </View>

              {isComplete && (
                <View style={styles.completeBadge}>
                  <Icon name="check-shield" size={16} color={theme.primary} />
                  <Text variant="xs" weight="semibold" color={theme.primary}>Complete</Text>
                </View>
              )}
            </Card>
          );
        })}

        {/* Info Card */}
        <Card style={[styles.infoCard, { backgroundColor: theme.surface + 'CC' }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={theme.accent} />
            <Text variant="h3" weight="semibold">How It Works</Text>
          </View>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Icon name="check-shield" size={16} color={theme.primary} />
              <Text variant="small" muted style={styles.infoText}>
                Complete lessons to earn coins
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="check-shield" size={16} color={theme.primary} />
              <Text variant="small" muted style={styles.infoText}>
                Answer quizzes correctly to progress
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="check-shield" size={16} color={theme.primary} />
              <Text variant="small" muted style={styles.infoText}>
                Review signals to improve your skills
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="refresh" size={16} color={theme.yellow} />
              <Text variant="small" muted style={styles.infoText}>
                Quests reset daily at midnight
              </Text>
            </View>
          </View>
        </Card>

        {/* Bottom Spacing */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB onPress={() => router.push('/ai-chat')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  progressCard: {
    gap: tokens.spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressInfo: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  questCard: {
    gap: tokens.spacing.sm,
    position: 'relative',
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questInfo: {
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
    height: 20,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: tokens.radius.sm,
  },
  completeBadge: {
    position: 'absolute',
    top: tokens.spacing.xs,
    right: tokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  infoCard: {
    gap: tokens.spacing.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  infoList: {
    gap: tokens.spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
});
