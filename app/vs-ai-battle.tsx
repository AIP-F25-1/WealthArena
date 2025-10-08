import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
      <Card style={styles.header}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  header: {
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


