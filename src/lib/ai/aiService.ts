/**
 * AI Triage Client Service (MVP-09)
 * Vetopia Mobile
 */

import { env } from '../../config/env';
import { supabase } from '../supabase/client';
import { TriageChatRequest, TriageStreamEvent } from '../../types/ai';

export const FALLBACK_ERROR_MESSAGE =
  'AI assistant unavailable. If this is an emergency, please contact an in-person clinic immediately.';

export interface StreamTriageChatOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  inactivityTimeoutMs?: number;
}

export class AIService {
  private apiUrl: string;

  constructor(apiUrl: string = env.apiUrl) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
  }

  /**
   * Resolves the canonical full endpoint URL for AI triage chat,
   * guaranteeing that /api/v1 is never duplicated regardless of base URL structure.
   */
  getEndpointUrl(path: string = '/ai/triage-chat'): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const base = this.apiUrl.endsWith('/api/v1') ? this.apiUrl : `${this.apiUrl}/api/v1`;
    return `${base}${normalizedPath}`;
  }

  /**
   * Streams triage conversation from the AI gateway
   */
  async streamTriageChat(
    request: TriageChatRequest,
    onEvent: (event: TriageStreamEvent) => void,
    options?: StreamTriageChatOptions,
  ): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 30000;
    const inactivityTimeoutMs = options?.inactivityTimeoutMs ?? 30000;
    const controller = new AbortController();
    let isAbortedExternally = false;
    let isTimedOut = false;

    // Link external abort signal if provided
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort();
        return;
      }
      options.signal.addEventListener('abort', () => {
        isAbortedExternally = true;
        controller.abort();
      });
    }

    let connectionTimer: NodeJS.Timeout | null = setTimeout(() => {
      isTimedOut = true;
      controller.abort();
    }, timeoutMs);

    let inactivityTimer: NodeJS.Timeout | null = null;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, inactivityTimeoutMs);
    };

    const cleanupTimers = () => {
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        connectionTimer = null;
      }
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    };

    try {
      // 1. Retrieve session access token if authenticated
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (controller.signal.aborted || options?.signal?.aborted) {
        cleanupTimers();
        return;
      }

      const url = this.getEndpointUrl('/ai/triage-chat');

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Headers received; clear connection timeout
      if (connectionTimer) {
        clearTimeout(connectionTimer);
        connectionTimer = null;
      }

      if (!response.ok) {
        cleanupTimers();
        if (response.status === 429) {
          const errData = await response.json().catch(() => null);
          onEvent({
            error:
              errData?.error?.message ||
              'Rate limit exceeded. Please wait a few moments before trying again.',
            isEmergency: false,
            done: true,
          });
          return;
        }

        onEvent({
          error: FALLBACK_ERROR_MESSAGE,
          isEmergency: true,
          done: true,
        });
        return;
      }

      // Initialize inactivity timer for initial stream chunk
      resetInactivityTimer();

      // 2. Stream chunk reading
      if (response.body && typeof (response.body as any).getReader === 'function') {
        const reader = (response.body as any).getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          resetInactivityTimer();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              cleanupTimers();
              onEvent({ done: true });
              return;
            }

            try {
              const parsed = JSON.parse(payload);
              onEvent(parsed);
            } catch {
              // Ignore partial JSON
            }
          }
        }

        cleanupTimers();
        onEvent({ done: true });
      } else {
        // Fallback for non-streaming environments (e.g. React Native):
        // Clean up the inactivity timer before awaiting full response text to prevent premature abort
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
          inactivityTimer = null;
        }
        const text = await response.text();
        cleanupTimers();
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            onEvent(parsed);
          } catch {
            // Ignore
          }
        }
        onEvent({ done: true });
      }
    } catch (err: any) {
      cleanupTimers();

      const isCanceled =
        isAbortedExternally ||
        options?.signal?.aborted ||
        controller.signal.aborted ||
        err?.name === 'AbortError' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('canceled') ||
            err.message.includes('cancelled') ||
            err.message.includes('aborted')));

      // If intentionally canceled (user navigated away, unmounted, or sent new prompt), exit quietly
      if (isCanceled && !isTimedOut) {
        return;
      }

      if (isTimedOut) {
        console.warn(`[AIService] Triage request timed out after ${timeoutMs}ms`);
        onEvent({
          error: FALLBACK_ERROR_MESSAGE,
          isEmergency: true,
          done: true,
        });
        return;
      }

      console.warn('[AIService] streamTriageChat error:', err);
      onEvent({
        error: FALLBACK_ERROR_MESSAGE,
        isEmergency: true,
        done: true,
      });
    }
  }
}

export const aiService = new AIService();
