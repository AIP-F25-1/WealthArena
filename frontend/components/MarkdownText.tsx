import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/design-system';

interface MarkdownTextProps {
  children: string;
  color?: string;
  variant?: 'body' | 'caption' | 'heading';
}

/**
 * Simple markdown renderer for chat messages
 * Supports: **bold**, *italic*, `code`, # headings, - lists, 1. numbered lists
 */
export function MarkdownText({ children, color, variant = 'body' }: MarkdownTextProps) {
  const theme = useTheme();
  const textColor = color || theme.text;

  // Parse markdown and convert to React Native Text components
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Patterns for different markdown elements
    const patterns = [
      // Bold: **text** or __text__
      { regex: /\*\*([^*]+)\*\*|__([^_]+)__/g, style: styles.bold },
      // Italic: *text* or _text_
      { regex: /(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g, style: styles.italic },
      // Inline code: `code`
      { regex: /`([^`]+)`/g, style: styles.code },
      // Headings: # Heading
      { regex: /^### (.*$)/gm, style: styles.h3 },
      { regex: /^## (.*$)/gm, style: styles.h2 },
      { regex: /^# (.*$)/gm, style: styles.h1 },
    ];

    // Split by newlines first to handle lists and paragraphs
    const lines = text.split('\n');
    const processedLines: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      // Check for numbered list: 1. item
      if (/^\d+\.\s/.test(line)) {
        const content = line.replace(/^\d+\.\s/, '');
        processedLines.push(
          <View key={`line-${lineIndex}`} style={styles.listItem}>
            <Text style={[styles.listNumber, { color: textColor }]}>
              {line.match(/^\d+\./)?.[0]} 
            </Text>
            <View style={styles.listContent}>
              {renderInlineMarkdown(content, textColor)}
            </View>
          </View>
        );
        return;
      }

      // Check for bullet list: - item, * item, or • item (handle both markdown and direct bullet)
      // Also handle lines that start with • after trimming whitespace
      const trimmedLine = line.trim();
      if (/^[-*•]\s/.test(line) || /^•\s*/.test(trimmedLine)) {
        // Remove bullet marker (-, *, or •) and any leading whitespace
        const content = line.replace(/^[-*•]\s*/, '').trim();
        if (content) {
          processedLines.push(
            <View key={`line-${lineIndex}`} style={styles.listItem}>
              <Text style={[styles.bullet, { color: textColor }]}>• </Text>
              <View style={styles.listContent}>
                {renderInlineMarkdown(content, textColor)}
              </View>
            </View>
          );
          return;
        }
      }

      // Check for headings
      if (line.startsWith('### ')) {
        processedLines.push(
          <Text key={`line-${lineIndex}`} style={[styles.h3, { color: textColor }]}>
            {line.replace(/^###\s/, '')}
          </Text>
        );
        return;
      }
      if (line.startsWith('## ')) {
        processedLines.push(
          <Text key={`line-${lineIndex}`} style={[styles.h2, { color: textColor }]}>
            {line.replace(/^##\s/, '')}
          </Text>
        );
        return;
      }
      if (line.startsWith('# ')) {
        processedLines.push(
          <Text key={`line-${lineIndex}`} style={[styles.h1, { color: textColor }]}>
            {line.replace(/^#\s/, '')}
          </Text>
        );
        return;
      }

      // Regular paragraph
      if (line.trim()) {
        processedLines.push(
          <Text key={`line-${lineIndex}`} style={[styles.paragraph, { color: textColor }]}>
            {renderInlineMarkdown(line, textColor)}
          </Text>
        );
      } else {
        // Empty line for spacing
        processedLines.push(<View key={`line-${lineIndex}`} style={styles.spacing} />);
      }
    });

    return processedLines;
  };

  // Render inline markdown (bold, italic, code)
  const renderInlineMarkdown = (text: string, textColor: string): React.ReactNode[] => {
    if (!text) return [<Text key="empty" style={{ color: textColor }} />];
    
    // Clean up any escaped markdown characters that shouldn't be displayed
    // Remove backslashes before markdown characters (e.g., \* becomes *)
    text = text.replace(/\\([`*_])/g, '$1');
    
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Process in order: code blocks first (to avoid conflicts), then bold, then italic
    while (remaining.length > 0) {
      // Check for code: `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <Text key={`code-${key++}`} style={[styles.code, { color: textColor }]}>
            {codeMatch[1]}
          </Text>
        );
        remaining = remaining.substring(codeMatch[0].length);
        continue;
      }

      // Check for bold: **text** or __text__
      const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)\1/);
      if (boldMatch) {
        parts.push(
          <Text key={`bold-${key++}`} style={[styles.bold, { color: textColor }]}>
            {boldMatch[2]}
          </Text>
        );
        remaining = remaining.substring(boldMatch[0].length);
        continue;
      }

      // Check for italic: *text* or _text_ (but not ** or __)
      // First check if it's not bold
      if (remaining[0] === '*' && remaining[1] === '*') {
        // Skip, will be handled by bold
        const nextText = remaining.substring(1);
        const textEnd = nextText.search(/[`*_]/);
        if (textEnd > 0) {
          parts.push(
            <Text key={`text-${key++}`} style={{ color: textColor }}>
              {remaining.substring(0, textEnd + 1)}
            </Text>
          );
          remaining = remaining.substring(textEnd + 1);
          continue;
        }
      }
      
      const italicMatch = remaining.match(/^([*_])([^*_\n]+)\1/);
      if (italicMatch) {
        parts.push(
          <Text key={`italic-${key++}`} style={[styles.italic, { color: textColor }]}>
            {italicMatch[2]}
          </Text>
        );
        remaining = remaining.substring(italicMatch[0].length);
        continue;
      }

      // Regular text - take until next markdown or end
      const nextMarkdown = remaining.search(/[`*_]/);
      if (nextMarkdown > 0) {
        parts.push(
          <Text key={`text-${key++}`} style={{ color: textColor }}>
            {remaining.substring(0, nextMarkdown)}
          </Text>
        );
        remaining = remaining.substring(nextMarkdown);
      } else {
        // No more markdown, add rest as text
        parts.push(
          <Text key={`text-${key++}`} style={{ color: textColor }}>
            {remaining}
          </Text>
        );
        break;
      }
    }

    return parts.length > 0 ? parts : [<Text key="default" style={{ color: textColor }}>{text}</Text>];
  };

  return (
    <View style={styles.container}>
      {parseMarkdown(children)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 4,
  },
  listNumber: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '600',
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '600',
  },
  listContent: {
    flex: 1,
  },
  spacing: {
    height: 8,
  },
});

