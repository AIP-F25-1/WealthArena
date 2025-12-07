import React from 'react';
import { Redirect } from 'expo-router';
import { useUserTier } from '@/contexts/UserTierContext';
import { useUser } from '@/contexts/UserContext';

export default function Index() {
  const { profile, isLoading } = useUserTier();
  const { isAuthenticated } = useUser();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Redirect href="/splash" />;
  }

  if (!profile.tier) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
