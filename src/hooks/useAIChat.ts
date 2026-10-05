/**
 * React Hook for AI Triage Chatbot (MVP-09)
 * Vetopia Mobile
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/ai';
import { Pet } from '../types/pet';
import { aiService, FALLBACK_ERROR_MESSAGE } from '../lib/ai/aiService';

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  id: 'greeting-initial',
  role: 'assistant',
  content:
    "Hello! I'm Vetopia AI, your 24/7 veterinary triage assistant. How can I help you today? Please describe your companion's symptoms, behavior changes, or care questions.\n\n*Note: I can provide educational guidance and help assess urgency, but I cannot prescribe medication or diagnose medical conditions.*",
  createdAt: new Date().toISOString(),
};

export function useAIChat(initialPet?: Pet | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(initialPet || null);
  const [error, setError] = useState<string | null>(null);

  const assistantMessageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up any pending streaming request when component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (textToSend?: string) => {
      const content = (textToSend !== undefined ? textToSend : input).trim();
      if (!content || isStreaming) return;

      // Abort any prior in-flight request
      abortControllerRef.current?.abort();
      const currentController = new AbortController();
      abortControllerRef.current = currentController;

      setInput('');
      setError(null);

      const userMsgId = `user-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };

      const assistantMsgId = `assistant-${Date.now() + 1}`;
      assistantMessageIdRef.current = assistantMsgId;

      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };

      // Construct history for API: last 8 messages + new user message
      const historyToSend = [
        ...messages
          .filter((m) => m.id !== 'greeting-initial')
          .slice(-8)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content },
      ];

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setIsStreaming(true);

      let accumulatedContent = '';
      let emergencyFlagged = false;

      await aiService.streamTriageChat(
        {
          messages: historyToSend,
          petId: selectedPet?.id,
        },
        (event) => {
          if (event.error) {
            setError(event.error);
            accumulatedContent = event.error;
            if (event.isEmergency) {
              emergencyFlagged = true;
              setIsEmergency(true);
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: accumulatedContent,
                      isEmergency: emergencyFlagged,
                    }
                  : msg,
              ),
            );
          } else if (event.text) {
            accumulatedContent += event.text;
            if (event.isEmergency) {
              emergencyFlagged = true;
              setIsEmergency(true);
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: accumulatedContent,
                      isEmergency: emergencyFlagged,
                    }
                  : msg,
              ),
            );
          }

          if (event.done) {
            setIsStreaming(false);
            if (!accumulatedContent && !error) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: FALLBACK_ERROR_MESSAGE,
                        isEmergency: true,
                      }
                    : msg,
                ),
              );
              setIsEmergency(true);
            }
          }
        },
        {
          signal: currentController.signal,
        },
      );
    },
    [input, isStreaming, messages, selectedPet, error],
  );

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
    setInput('');
    setIsStreaming(false);
    setIsEmergency(false);
    setError(null);
  }, []);

  return {
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
  };
}
