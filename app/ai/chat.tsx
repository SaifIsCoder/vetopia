/**
 * Screen SCR-AI-001: 24/7 AI Triage Chatbot Screen (MVP-09)
 * Vetopia Mobile
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send, RotateCcw, PawPrint, Check, X } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { DisclaimerBanner } from '../../src/components/ai/DisclaimerBanner';
import { EmergencyAlertCard } from '../../src/components/ai/EmergencyAlertCard';
import { SuggestionChips } from '../../src/components/ai/SuggestionChips';
import { ChatMessageItem } from '../../src/components/ai/ChatMessageItem';
import { useAIChat } from '../../src/hooks/useAIChat';
import { usePets } from '../../src/hooks/usePets';
import { Pet } from '../../src/types/pet';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

interface AIChatScreenProps {
  emergencyNumber?: string;
}

export default function AIChatScreen({ emergencyNumber }: AIChatScreenProps = {}) {
  const router = useRouter();
  const { data: pets } = usePets();
  const [petModalVisible, setPetModalVisible] = useState(false);

  const {
    messages,
    input,
    setInput,
    isStreaming,
    isEmergency,
    selectedPet,
    setSelectedPet,
    error,
    sendMessage,
    clearChat,
  } = useAIChat();

  const flatListRef = useRef<FlatList>(null);
  const lastMessageContent = messages[messages.length - 1]?.content;

  // Auto-scroll to latest message when new messages or chunks arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, lastMessageContent]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage();
  };

  const handleSelectSuggestion = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleSelectPet = (pet: Pet | null) => {
    setSelectedPet(pet);
    setPetModalVisible(false);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="btn-ai-back"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Heading level={4} style={styles.headerTitle}>
              24/7 AI Triage Assistant
            </Heading>
            <Text variant="caption" color={colors.muted}>
              Powered by Google Gemini 3.8 Flash
            </Text>
          </View>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={clearChat}
            accessibilityRole="button"
            accessibilityLabel="Reset conversation"
            testID="btn-ai-reset"
          >
            <RotateCcw size={18} color={colors.inkSoft} />
          </TouchableOpacity>
        </View>

        {/* Selected Pet Context Pill */}
        {pets && pets.length > 0 ? (
          <View style={styles.petSelectorBar}>
            <TouchableOpacity
              style={styles.petPill}
              onPress={() => setPetModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select pet context"
              testID="btn-select-pet-context"
            >
              <PawPrint size={14} color={colors.inkSoft} style={{ marginRight: 6 }} />
              <Text variant="caption" color={colors.ink} style={styles.petPillText}>
                {selectedPet
                  ? `Pet: ${selectedPet.name} (${selectedPet.species})`
                  : 'Select Pet Context (Optional)'}
              </Text>
            </TouchableOpacity>

            {selectedPet ? (
              <TouchableOpacity
                onPress={() => setSelectedPet(null)}
                style={styles.clearPetBtn}
                accessibilityLabel="Clear selected pet"
              >
                <X size={14} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Clinical Disclaimer Banner */}
        {/* <DisclaimerBanner /> */}

        {/* Emergency Red-Flag Alert Banner (renders dynamically on emergency detection) */}
        {isEmergency ? <EmergencyAlertCard emergencyNumber={emergencyNumber} /> : null}

        {/* Chat Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ChatMessageItem
              message={item}
              isStreaming={
                isStreaming && index === messages.length - 1 && item.role === 'assistant'
              }
            />
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            showSuggestions ? <SuggestionChips onSelect={handleSelectSuggestion} /> : null
          }
        />

        {/* Error Fallback Note */}
        {error && !messages.some((m) => m.content.includes(error)) ? (
          <Card style={styles.errorCard}>
            <Text variant="caption" color={colors.destructive} style={{ textAlign: 'center' }}>
              {error}
            </Text>
          </Card>
        ) : null}

        {/* Bottom Composer */}
        <View style={styles.composerContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Describe symptoms, duration, behavior..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              editable={!isStreaming}
              accessibilityLabel="Symptom description input"
              testID="ai-symptom-input"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              !input.trim() || isStreaming ? styles.sendButtonDisabled : null,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
            accessibilityRole="button"
            accessibilityLabel="Send message to AI assistant"
            testID="btn-ai-send"
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Send size={18} color={colors.ink} />
            )}
          </TouchableOpacity>
        </View>

        {/* Pet Selection Modal */}
        <Modal
          visible={petModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPetModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Heading level={4}>Select Pet Context</Heading>
                <TouchableOpacity onPress={() => setPetModalVisible(false)}>
                  <X size={20} color={colors.ink} />
                </TouchableOpacity>
              </View>

              <Text variant="caption" color={colors.muted} style={styles.modalSub}>
                Providing pet context helps the AI evaluate species-specific risks and age
                considerations.
              </Text>

              <TouchableOpacity
                style={[styles.modalItem, !selectedPet ? styles.modalItemSelected : null]}
                onPress={() => handleSelectPet(null)}
              >
                <Text variant="bodySm" color={colors.ink}>
                  None (General Assessment)
                </Text>
                {!selectedPet ? <Check size={16} color={colors.primaryDark} /> : null}
              </TouchableOpacity>

              {pets?.map((pet) => {
                const isSelected = selectedPet?.id === pet.id;
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[styles.modalItem, isSelected ? styles.modalItemSelected : null]}
                    onPress={() => handleSelectPet(pet)}
                  >
                    <View>
                      <Text variant="bodySm" color={colors.ink} style={{ fontWeight: '600' }}>
                        {pet.name}
                      </Text>
                      <Text variant="caption" color={colors.muted}>
                        {pet.species} {pet.breed ? `• ${pet.breed}` : ''}
                      </Text>
                    </View>
                    {isSelected ? <Check size={16} color={colors.primaryDark} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cream,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    color: colors.ink,
  },
  resetButton: {
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  petSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  petPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  petPillText: {
    fontWeight: '600',
  },
  clearPetBtn: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  messagesList: {
    flexGrow: 1,
    paddingBottom: spacing.sm,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(220, 38, 38, 0.3)',
    marginBottom: spacing.xs,
    padding: spacing.xs + 2,
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: spacing.xs,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 14,
    color: colors.ink,
    minHeight: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
    backgroundColor: colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalSub: {
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  modalItemSelected: {
    backgroundColor: colors.surface,
  },
});
