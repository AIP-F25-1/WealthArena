import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Text, Button, Icon } from '@/src/design-system';

export default function NotFoundScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Icon name="alert" size={64} color={theme.muted} />
        <Text variant="h2" weight="bold" center style={styles.title}>
          Page Not Found
        </Text>
        <Text variant="body" center muted style={styles.subtitle}>
          The page you're looking for doesn't exist.
        </Text>
        <Button
          variant="primary"
          size="large"
          onPress={() => router.push('/dashboard')}
          icon={<Icon name="home" size={20} color={theme.bg} />}
        >
          Go to Dashboard
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 24,
    marginBottom: 12,
  },
  subtitle: {
    marginBottom: 32,
  },
});

