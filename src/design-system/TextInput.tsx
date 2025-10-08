// TextInput Component - Styled text input with validation
import React, { useState } from 'react';
import { TextInput as RNTextInput, View, StyleSheet, TextInputProps as RNTextInputProps, Pressable, Platform } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { tokens } from './tokens';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export const TextInput = ({
  label,
  error,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: TextInputProps) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="small" weight="semibold" style={styles.label}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : isFocused ? theme.primary : theme.border,
          },
          style,
        ]}
      >
        <RNTextInput
          style={[styles.input, { color: theme.text }]}
          placeholderTextColor={theme.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && (
          <Pressable 
            onPress={onRightIconPress}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {rightIcon}
          </Pressable>
        )}
      </View>
      {error && (
        <Text variant="small" color={theme.danger} style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.md,
  },
  label: {
    marginBottom: tokens.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    paddingHorizontal: tokens.spacing.md,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: tokens.font.sizes.body,
    paddingVertical: tokens.spacing.sm,
    includeFontPadding: false,
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
      paddingVertical: tokens.spacing.sm,
    }),
  },
  iconButton: {
    padding: tokens.spacing.xs,
  },
  error: {
    marginTop: tokens.spacing.xs,
  },
});

