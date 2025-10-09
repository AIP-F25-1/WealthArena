import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '@/src/design-system';

export default function IndexScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    // Redirect to splash screen immediately
    router.replace('/splash');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }} />
  );
}

