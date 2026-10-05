/**
 * Component Tests for 24/7 AI Triage Chatbot Screen (SCR-AI-001)
 * Vetopia Mobile
 */

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AIChatScreen from '../../app/ai/chat';
import { aiService } from '../../src/lib/ai/aiService';

// Mock Router
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock Linking
jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

// Mock Pets Hook
jest.mock('../../src/hooks/usePets', () => ({
  usePets: () => ({
    data: [
      {
        id: 'pet-1',
        name: 'Buddy',
        species: 'Dog',
        breed: 'Golden Retriever',
      },
    ],
  }),
}));

// Mock AI Service Streaming
jest.mock('../../src/lib/ai/aiService', () => ({
  FALLBACK_ERROR_MESSAGE:
    'AI assistant unavailable. If this is an emergency, please contact an in-person clinic immediately.',
  aiService: {
    streamTriageChat: jest.fn(),
  },
}));

describe('SCR-AI-001: 24/7 AI Triage Chatbot Screen Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. Renders screen header, disclaimer banner, and initial assistant greeting', () => {
    const { getByText, getByTestId } = render(<AIChatScreen />);

    expect(getByText('24/7 AI Triage Assistant')).toBeTruthy();
    expect(getByText('Powered by Google Gemini 3.8 Flash')).toBeTruthy();
    expect(getByTestId('ai-disclaimer-banner')).toBeTruthy();
    expect(getByText(/Vetopia AI provides triage guidance and care education/)).toBeTruthy();
    expect(getByTestId('chat-message-assistant')).toBeTruthy();
    expect(getByText(/Hello! I'm Vetopia AI/)).toBeTruthy();
  });

  test('2. Renders quick suggestion chips on initial empty state', () => {
    const { getByTestId, getByText } = render(<AIChatScreen />);

    expect(getByTestId('ai-suggestion-chips')).toBeTruthy();
    expect(getByText('Dog ate dark chocolate')).toBeTruthy();
    expect(getByText('Cat vomiting yellow foam')).toBeTruthy();
  });

  test('3. Tapping back button navigates back', () => {
    const { getByTestId } = render(<AIChatScreen />);

    fireEvent.press(getByTestId('btn-ai-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('4. Submitting an emergency query triggers streaming and renders Emergency Alert Card with hospital guidance when no direct dial is configured', async () => {
    (aiService.streamTriageChat as jest.Mock).mockImplementation((_req, onEvent) => {
      onEvent({
        text: 'Warning: [EMERGENCY_DETECTED] Dark chocolate toxicity detected.',
        isEmergency: true,
      });
      onEvent({ done: true });
      return Promise.resolve();
    });

    const { getByTestId, getByText, queryByTestId } = render(<AIChatScreen />);

    // Initially no emergency card
    expect(queryByTestId('ai-emergency-alert-card')).toBeNull();

    const input = getByTestId('ai-symptom-input');
    fireEvent.changeText(input, 'My dog ate dark chocolate');

    const sendBtn = getByTestId('btn-ai-send');
    await act(async () => {
      fireEvent.press(sendBtn);
    });

    await waitFor(() => {
      expect(getByTestId('ai-emergency-alert-card')).toBeTruthy();
      expect(getByText('CRITICAL: Potential Emergency')).toBeTruthy();
      // No hardcoded 911 call button when unconfigured
      expect(getByTestId('emergency-guidance-instruction')).toBeTruthy();
      expect(getByTestId('btn-connect-video-specialist')).toBeTruthy();
    });
  });

  test('5. Configured emergency veterinary number renders call button and launches dialer', async () => {
    (aiService.streamTriageChat as jest.Mock).mockImplementation((_req, onEvent) => {
      onEvent({ text: 'Collapse detected', isEmergency: true });
      onEvent({ done: true });
      return Promise.resolve();
    });

    const verifiedVetContact = '+92-300-5550199';
    const { getByTestId } = render(<AIChatScreen emergencyNumber={verifiedVetContact} />);

    const input = getByTestId('ai-symptom-input');
    fireEvent.changeText(input, 'Dog collapsed');

    await act(async () => {
      fireEvent.press(getByTestId('btn-ai-send'));
    });

    await waitFor(() => {
      expect(getByTestId('btn-call-emergency-vet')).toBeTruthy();
    });

    fireEvent.press(getByTestId('btn-call-emergency-vet'));
    expect(Linking.openURL).toHaveBeenCalledWith(`tel:${verifiedVetContact}`);
  });

  test('6. Emergency "Connect to Video Specialist" button navigates to /vets', async () => {
    (aiService.streamTriageChat as jest.Mock).mockImplementation((_req, onEvent) => {
      onEvent({ text: 'Acute breathing issue', isEmergency: true });
      onEvent({ done: true });
      return Promise.resolve();
    });

    const { getByTestId } = render(<AIChatScreen />);

    const input = getByTestId('ai-symptom-input');
    fireEvent.changeText(input, 'Dog struggling to breathe');

    await act(async () => {
      fireEvent.press(getByTestId('btn-ai-send'));
    });

    await waitFor(() => {
      expect(getByTestId('btn-connect-video-specialist')).toBeTruthy();
    });

    fireEvent.press(getByTestId('btn-connect-video-specialist'));
    expect(mockPush).toHaveBeenCalledWith('/vets');
  });

  test('7. Tapping a suggestion chip sends the prompt automatically', async () => {
    (aiService.streamTriageChat as jest.Mock).mockImplementation((_req, onEvent) => {
      onEvent({ text: 'Vaccines are essential preventive care.', isEmergency: false });
      onEvent({ done: true });
      return Promise.resolve();
    });

    const { getByText } = render(<AIChatScreen />);

    const chip = getByText('Puppy vaccine schedule');
    await act(async () => {
      fireEvent.press(chip);
    });

    expect(aiService.streamTriageChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: 'Puppy vaccine schedule' }),
        ]),
      }),
      expect.any(Function),
      expect.anything(),
    );
  });

  test('8. Reset conversation button clears messages and resets emergency state', async () => {
    (aiService.streamTriageChat as jest.Mock).mockImplementation((_req, onEvent) => {
      onEvent({ text: 'Severe emergency alert', isEmergency: true });
      onEvent({ done: true });
      return Promise.resolve();
    });

    const { getByTestId, queryByTestId } = render(<AIChatScreen />);

    fireEvent.changeText(getByTestId('ai-symptom-input'), 'Critical issue');
    await act(async () => {
      fireEvent.press(getByTestId('btn-ai-send'));
    });

    await waitFor(() => {
      expect(getByTestId('ai-emergency-alert-card')).toBeTruthy();
    });

    // Reset conversation
    fireEvent.press(getByTestId('btn-ai-reset'));

    expect(queryByTestId('ai-emergency-alert-card')).toBeNull();
  });
});
