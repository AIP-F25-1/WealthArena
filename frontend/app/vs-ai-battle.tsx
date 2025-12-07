import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text, Card, Button, tokens, HumanAvatar, RobotAvatar, ProgressRing } from '@/src/design-system';

export default function VsAIBattle() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ scenario?: string }>();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (countdown < 0) {
      router.replace({ pathname: '/vs-ai-play', params: { scenario: String(params.scenario || 'covid') } });
    }
  }, [countdown]);

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
        <Text variant="h3" weight="semibold" style={styles.headerTitle}>Get Ready</Text>
        <View style={styles.headerRight} />
      </View>
      
      <View style={styles.content}>
        <Card style={styles.headerCard}>
          <Text variant="h2" weight="bold" center>Get Ready</Text>
          <Text variant="small" muted center>Who will win this round?</Text>
        </Card>

        <View style={styles.avatarsRow}>
        <HumanAvatar size={110} />
        <Text variant="h1" weight="bold">{countdown >= 0 ? countdown : 'Go!'}</Text>
        <RobotAvatar size={110} />
      </View>

        <Card style={styles.tipCard}>
          <Text variant="small" muted>Tip: Keep max drawdown low while maximizing return.</Text>
        </Card>

        <Button variant="secondary" size="large" onPress={() => router.replace('/vs-ai-start')} fullWidth>Cancel</Button>
      </View>
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
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  headerCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tipCard: {
    alignItems: 'center',
  },
});


