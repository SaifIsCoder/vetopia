/**
 * Quick Suggestion Chips for AI Triage (MVP-09)
 * Vetopia Mobile
 */

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

interface SuggestionChipsProps {
  onSelect: (prompt: string) => void;
}

const DEFAULT_SUGGESTIONS = [
  'Dog ate dark chocolate',
  'Cat vomiting yellow foam',
  'Puppy vaccine schedule',
  'Dog has swollen hard belly',
  'Cat straining to urinate',
];

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <View style={styles.container} testID="ai-suggestion-chips">
      <View style={styles.header}>
        <Sparkles size={14} color={colors.muted} />
        <Text variant="caption" color={colors.muted} style={styles.headerText}>
          Suggested triage questions:
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DEFAULT_SUGGESTIONS.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.chip}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Suggested question: ${item}`}
          >
            <Text variant="caption" color={colors.ink} style={styles.chipText}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    marginLeft: 4,
    fontWeight: '600',
  },
  scrollContent: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontWeight: '500',
  },
});
