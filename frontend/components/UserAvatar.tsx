import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { FoxMascot } from '@/src/design-system/mascots';
import { User } from '@/contexts/UserContext';

interface UserAvatarProps {
  user: User | null;
  size?: number;
  style?: any;
  contextual?: boolean; // Enable contextual changes
  context?: 'dashboard' | 'learning' | 'game' | 'profile' | 'celebration' | 'warning';
}

export default function UserAvatar({ user, size = 80, style, contextual = false, context }: UserAvatarProps) {
  // Default to neutral mascot if no user or avatar data
  const avatarType = user?.avatar_type || 'mascot';
  const avatarVariant = user?.avatar_variant || 'neutral';
  const avatarUrl = user?.avatar_url;

  // Determine contextual variant
  const getContextualVariant = () => {
    if (!contextual || !context) return avatarVariant;
    
    switch (context) {
      case 'dashboard':
        return 'excited';
      case 'learning':
        return 'learning';
      case 'game':
        return 'confident';
      case 'profile':
        return 'neutral';
      case 'celebration':
        return 'celebration';
      case 'warning':
        return 'cautious';
      default:
        return avatarVariant;
    }
  };

  const displayVariant = getContextualVariant();

  if (avatarType === 'custom' && avatarUrl) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Default to mascot
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <FoxMascot variant={displayVariant} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: '#f0f0f0',
  },
});
