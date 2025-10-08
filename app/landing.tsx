import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Button, Card, Icon, FoxMascot, tokens } from '@/src/design-system';

export default function Landing() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <FoxMascot variant="confident" size={160} />
          <Text variant="h1" weight="bold" center style={styles.title}>
            WealthArena
          </Text>
          <Text variant="body" center muted style={styles.subtitle}>
            Learn trading through gamified experiences and build real portfolio skills
          </Text>
          
          <View style={styles.ctaButtons}>
            <Button
              variant="primary"
              size="large"
              onPress={() => router.push('/signup')}
              fullWidth
              icon={<Icon name="trophy" size={20} color={theme.bg} />}
            >
              Get Started
            </Button>
            <Button
              variant="ghost"
              size="large"
              onPress={() => router.push('/login')}
              fullWidth
            >
              Sign In
            </Button>
          </View>
        </View>

        {/* Feature Cards */}
        <View style={styles.features}>
          <Card style={styles.featureCard}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.primary + '20' }]}>
              <Icon name="agent" size={32} color={theme.primary} />
            </View>
            <Text variant="h3" weight="semibold">Guided Onboarding</Text>
            <Text variant="small" muted style={styles.featureText}>
              AI assistant helps you set up your portfolio based on your goals and risk tolerance
            </Text>
          </Card>

          <Card style={styles.featureCard}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.accent + '20' }]}>
              <Icon name="trophy" size={32} color={theme.accent} />
            </View>
            <Text variant="h3" weight="semibold">Gamified Dashboard</Text>
            <Text variant="small" muted style={styles.featureText}>
              Earn XP, unlock achievements, and level up as you learn and make smart trades
            </Text>
          </Card>

          <Card style={styles.featureCard}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.yellow + '20' }]}>
              <Icon name="shield" size={32} color={theme.yellow} />
            </View>
            <Text variant="h3" weight="semibold">Risk Management</Text>
            <Text variant="small" muted style={styles.featureText}>
              Built-in VaR analysis and portfolio hedging tools to protect your investments
            </Text>
          </Card>

          <Card style={styles.featureCard}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.primary + '20' }]}>
              <Icon name="replay" size={32} color={theme.primary} />
            </View>
            <Text variant="h3" weight="semibold">Historical Replay</Text>
            <Text variant="small" muted style={styles.featureText}>
              Practice with real historical market data in fast-forward mode
            </Text>
          </Card>
        </View>

        {/* Footer */}
        <Text variant="xs" center muted style={styles.footer}>
          WealthArena 2025 - All rights reserved
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: { 
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  title: {
    marginBottom: tokens.spacing.xs,
  },
  subtitle: {
    maxWidth: 320,
    marginBottom: tokens.spacing.md,
  },
  ctaButtons: {
    width: '100%',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  features: {
    gap: tokens.spacing.md,
  },
  featureCard: {
    gap: tokens.spacing.sm,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
  },
  featureText: {
    lineHeight: 18,
  },
  footer: {
    paddingVertical: tokens.spacing.xl,
  },
});
