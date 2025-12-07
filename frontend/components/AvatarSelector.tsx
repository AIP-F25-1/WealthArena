import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { useTheme, Text, Card, Button, Icon, tokens } from '@/src/design-system';
import { FoxMascot, FoxVariant } from '@/src/design-system/mascots';

interface AvatarSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (avatar: { type: 'mascot'; variant: FoxVariant } | { type: 'custom'; url: string }) => void;
  currentAvatar?: { type: 'mascot'; variant: FoxVariant } | { type: 'custom'; url: string };
}

const MASCOT_VARIANTS: { variant: FoxVariant; name: string; description: string }[] = [
  { variant: 'neutral', name: 'Neutral', description: 'Calm and composed' },
  { variant: 'excited', name: 'Excited', description: 'Energetic and enthusiastic' },
  { variant: 'confident', name: 'Confident', description: 'Self-assured and bold' },
  { variant: 'thinking', name: 'Thinking', description: 'Thoughtful and analytical' },
  { variant: 'winner', name: 'Winner', description: 'Victorious and triumphant' },
  { variant: 'learning', name: 'Learning', description: 'Curious and studious' },
  { variant: 'worried', name: 'Worried', description: 'Cautious and careful' },
  { variant: 'sleepy', name: 'Sleepy', description: 'Relaxed and peaceful' },
  { variant: 'celebrating', name: 'Celebrating', description: 'Joyful and festive' },
  { variant: 'motivating', name: 'Motivating', description: 'Inspiring and encouraging' },
];

export default function AvatarSelector({ visible, onClose, onSelect, currentAvatar }: AvatarSelectorProps) {
  const { theme } = useTheme();
  const [selectedType, setSelectedType] = useState<'mascot' | 'custom'>('mascot');
  const [selectedMascot, setSelectedMascot] = useState<FoxVariant>(
    currentAvatar?.type === 'mascot' ? currentAvatar.variant : 'neutral'
  );

  const handleMascotSelect = (variant: FoxVariant) => {
    setSelectedMascot(variant);
  };

  const handleConfirm = () => {
    if (selectedType === 'mascot') {
      onSelect({ type: 'mascot', variant: selectedMascot });
    } else {
      // For custom avatars, we'll show an alert for now
      // In a real app, this would open image picker
      Alert.alert(
        'Custom Avatar',
        'Custom avatar upload will be implemented in a future update. Please select a mascot for now.',
        [{ text: 'OK' }]
      );
      return;
    }
    onClose();
  };

  const handleCustomAvatar = () => {
    Alert.alert(
      'Coming Soon',
      'Custom avatar upload feature will be available in a future update. Please select a mascot for now.',
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Icon name="x" size={24} color={theme.text} />
          </Pressable>
          <Text variant="h3" weight="semibold" style={styles.headerTitle}>
            Choose Your Avatar
          </Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Type Selector */}
          <View style={styles.typeSelector}>
            <Pressable
              onPress={() => setSelectedType('mascot')}
              style={[
                styles.typeButton,
                selectedType === 'mascot' && { backgroundColor: theme.primary + '20' }
              ]}
            >
              <Card style={[
                styles.typeCard,
                selectedType === 'mascot' && { borderColor: theme.primary, borderWidth: 2 }
              ]}>
                <Icon name="agent" size={32} color={theme.primary} />
                <Text variant="body" weight="semibold">Mascots</Text>
                <Text variant="small" muted>Choose from our collection</Text>
              </Card>
            </Pressable>

            <Pressable
              onPress={() => setSelectedType('custom')}
              style={[
                styles.typeButton,
                selectedType === 'custom' && { backgroundColor: theme.primary + '20' }
              ]}
            >
              <Card style={[
                styles.typeCard,
                selectedType === 'custom' && { borderColor: theme.primary, borderWidth: 2 }
              ]}>
                <Icon name="image" size={32} color={theme.accent} />
                <Text variant="body" weight="semibold">Custom</Text>
                <Text variant="small" muted>Upload your own image</Text>
              </Card>
            </Pressable>
          </View>

          {/* Mascot Selection */}
          {selectedType === 'mascot' && (
            <View style={styles.mascotSection}>
              <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
                Select a Mascot
              </Text>
              <Text variant="small" muted style={styles.sectionDescription}>
                Choose a mascot that represents your trading personality
              </Text>

              <View style={styles.mascotGrid}>
                {MASCOT_VARIANTS.map((mascot) => (
                  <Pressable
                    key={mascot.variant}
                    onPress={() => handleMascotSelect(mascot.variant)}
                    style={styles.mascotItem}
                  >
                    <Card style={[
                      styles.mascotCard,
                      selectedMascot === mascot.variant && { 
                        borderColor: theme.primary, 
                        borderWidth: 2,
                        backgroundColor: theme.primary + '10'
                      }
                    ]}>
                      <View style={styles.mascotPreview}>
                        <FoxMascot variant={mascot.variant} size={60} />
                      </View>
                      <Text variant="small" weight="semibold" center>
                        {mascot.name}
                      </Text>
                      <Text variant="xs" muted center numberOfLines={2}>
                        {mascot.description}
                      </Text>
                      {selectedMascot === mascot.variant && (
                        <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                          <Icon name="check" size={16} color={theme.bg} />
                        </View>
                      )}
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Custom Avatar Section */}
          {selectedType === 'custom' && (
            <View style={styles.customSection}>
              <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
                Custom Avatar
              </Text>
              <Text variant="small" muted style={styles.sectionDescription}>
                Upload your own profile picture
              </Text>

              <Card style={styles.customCard}>
                <View style={styles.customPlaceholder}>
                  <Icon name="image" size={48} color={theme.muted} />
                  <Text variant="body" weight="semibold" center>
                    Coming Soon
                  </Text>
                  <Text variant="small" muted center>
                    Custom avatar upload will be available in a future update
                  </Text>
                  <Button
                    variant="secondary"
                    size="medium"
                    onPress={handleCustomAvatar}
                    style={styles.customButton}
                  >
                    Learn More
                  </Button>
                </View>
              </Card>
            </View>
          )}

          {/* Preview */}
          <View style={styles.previewSection}>
            <Text variant="h3" weight="semibold" style={styles.sectionTitle}>
              Preview
            </Text>
            <Card style={styles.previewCard}>
              <View style={styles.previewContent}>
                <View style={styles.previewAvatar}>
                  {selectedType === 'mascot' ? (
                    <FoxMascot variant={selectedMascot} size={80} />
                  ) : (
                    <View style={[styles.customPreview, { backgroundColor: theme.surface }]}>
                      <Icon name="image" size={40} color={theme.muted} />
                    </View>
                  )}
                </View>
                <Text variant="body" weight="semibold">Your New Avatar</Text>
                <Text variant="small" muted>
                  {selectedType === 'mascot' 
                    ? MASCOT_VARIANTS.find(m => m.variant === selectedMascot)?.name
                    : 'Custom Avatar'
                  }
                </Text>
              </View>
            </Card>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Button
            variant="ghost"
            size="large"
            onPress={onClose}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="large"
            onPress={handleConfirm}
            style={styles.confirmButton}
          >
            Confirm Selection
          </Button>
        </View>
      </View>
    </Modal>
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
  closeButton: {
    padding: tokens.spacing.xs,
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
  },
  typeSelector: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  typeButton: {
    flex: 1,
  },
  typeCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
  },
  mascotSection: {
    marginBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.xs,
  },
  sectionDescription: {
    marginBottom: tokens.spacing.md,
  },
  mascotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  mascotItem: {
    width: '48%',
  },
  mascotCard: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    position: 'relative',
  },
  mascotPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
  },
  selectedIndicator: {
    position: 'absolute',
    top: tokens.spacing.xs,
    right: tokens.spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSection: {
    marginBottom: tokens.spacing.lg,
  },
  customCard: {
    padding: tokens.spacing.xl,
  },
  customPlaceholder: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  customButton: {
    marginTop: tokens.spacing.sm,
  },
  previewSection: {
    marginBottom: tokens.spacing.lg,
  },
  previewCard: {
    padding: tokens.spacing.lg,
  },
  previewContent: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  previewAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  customPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: tokens.spacing.md,
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});
