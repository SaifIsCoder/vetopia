/**
 * Google Gemini Flash Streaming Triage Service (MVP-09)
 * Vetopia Mobile
 */

import { CLINICAL_SYSTEM_PROMPT, detectRedFlags } from './safety';
import { PetClinicalContext } from '../../types/ai';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const APPROVED_FALLBACK_MODEL = 'gemini-3.8-flash';

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChunkHandler {
  onChunk: (text: string, isEmergency: boolean) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface StreamTriageOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class GeminiTriageService {
  private apiKey: string | null;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null;
    this.model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Builds the formatted prompt with pet clinical context and system safety guardrails
   */
  private buildSystemInstruction(petContext?: PetClinicalContext): string {
    let instruction = CLINICAL_SYSTEM_PROMPT;

    if (petContext) {
      instruction += `\n\nPATIENT MEDICAL PROFILE:\n`;
      instruction += `- Name: ${petContext.name}\n`;
      instruction += `- Species: ${petContext.species}\n`;
      if (petContext.breed) instruction += `- Breed: ${petContext.breed}\n`;
      if (petContext.age) instruction += `- Age: ${petContext.age}\n`;
      if (petContext.weight_kg) instruction += `- Weight: ${petContext.weight_kg} kg\n`;
      if (petContext.allergies && petContext.allergies.length > 0) {
        instruction += `- Known Allergies: ${petContext.allergies.join(', ')}\n`;
      }
      if (petContext.conditions && petContext.conditions.length > 0) {
        instruction += `- Pre-existing Conditions: ${petContext.conditions.join(', ')}\n`;
      }
    }

    return instruction;
  }

  /**
   * Streams triage assessment from Google Gemini or safe mock generator
   */
  async streamTriage(
    messages: ChatMessageInput[],
    petContext: PetClinicalContext | undefined,
    handler: StreamChunkHandler,
    options?: StreamTriageOptions,
  ): Promise<void> {
    if (options?.signal?.aborted) {
      return;
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const initialSafety = detectRedFlags(latestUserMessage);

    const activeApiKey = process.env.GEMINI_API_KEY || this.apiKey;
    const activeModel = process.env.GEMINI_MODEL || this.model || DEFAULT_GEMINI_MODEL;

    // If no live Gemini key configured, use deterministic clinical fallback generator
    if (!activeApiKey) {
      return this.streamMockTriage(latestUserMessage, initialSafety.isEmergency, handler, options);
    }

    const upstreamTimeoutMs = options?.timeoutMs ?? 15000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort(new Error('UPSTREAM_TIMEOUT'));
    }, upstreamTimeoutMs);

    // Combine external signal and internal timeout signal
    const onExternalAbort = () => {
      timeoutController.abort(new Error('CLIENT_ABORTED'));
    };
    if (options?.signal) {
      options.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const systemInstruction = this.buildSystemInstruction(petContext);

      // Convert messages to Gemini format (user -> user, assistant -> model)
      const contents = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const requestBody = {
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.2, // Low temperature for clinical safety
          maxOutputTokens: 1024,
        },
      };

      const url = `${this.baseUrl}/models/${activeModel}:streamGenerateContent?alt=sse&key=${activeApiKey}`;

      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: timeoutController.signal,
      });

      // Clear connection timeout
      clearTimeout(timeoutId);

      // If active model is unavailable, sunset, high demand (503), or quota-exhausted (429), fallback to approved secondary model
      if (
        (response.status === 404 ||
          response.status === 429 ||
          response.status === 503 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 504) &&
        activeModel !== APPROVED_FALLBACK_MODEL
      ) {
        console.warn(
          `[GeminiTriageService] Model "${activeModel}" returned ${response.status}. Falling back to approved fallback model "${APPROVED_FALLBACK_MODEL}".`,
        );
        const fallbackUrl = `${this.baseUrl}/models/${APPROVED_FALLBACK_MODEL}:streamGenerateContent?alt=sse&key=${activeApiKey}`;
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: timeoutController.signal,
        });
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
        if (response.status === 504 || response.status === 502) {
          throw new Error('GATEWAY_TIMEOUT');
        }
        throw new Error(`UPSTREAM_ERROR_${response.status}`);
      }

      if (!response.body) {
        throw new Error('EMPTY_RESPONSE_BODY');
      }

      // Stream parsing for SSE format
      const reader = (response.body as any).getReader ? (response.body as any).getReader() : null;
      const decoder = new TextDecoder();
      let buffer = '';
      let emergencyFlagged = initialSafety.isEmergency;

      if (reader) {
        while (true) {
          if (options?.signal?.aborted) {
            await reader.cancel().catch(() => {});
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                const parts = data.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                  if (part.text) {
                    const textChunk = part.text;
                    if (
                      textChunk.includes('[EMERGENCY_DETECTED]') ||
                      detectRedFlags(textChunk).isEmergency
                    ) {
                      emergencyFlagged = true;
                    }
                    if (!options?.signal?.aborted) {
                      handler.onChunk(textChunk, emergencyFlagged);
                    }
                  }
                }
              } catch {
                // Ignore partial JSON parsing errors in buffer
              }
            }
          }
        }
      } else {
        // Fallback for non-reader body
        const text = await response.text();
        const lines = text.split('\n');
        for (const line of lines) {
          if (options?.signal?.aborted) return;
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const data = JSON.parse(jsonStr);
              const parts = data.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  const textChunk = part.text;
                  if (
                    textChunk.includes('[EMERGENCY_DETECTED]') ||
                    detectRedFlags(textChunk).isEmergency
                  ) {
                    emergencyFlagged = true;
                  }
                  if (!options?.signal?.aborted) {
                    handler.onChunk(textChunk, emergencyFlagged);
                  }
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      }

      if (!options?.signal?.aborted) {
        handler.onDone();
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (options?.signal?.aborted) {
        return;
      }
      console.warn(
        '[GeminiTriageService] Upstream Gemini request failed; falling back to safe local triage generator:',
        err?.message || err,
      );
      return this.streamMockTriage(latestUserMessage, initialSafety.isEmergency, handler, options);
    } finally {
      clearTimeout(timeoutId);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  /**
   * Deterministic local development & testing triage response generator
   */
  private async streamMockTriage(
    userMessage: string,
    isEmergency: boolean,
    handler: StreamChunkHandler,
    options?: StreamTriageOptions,
  ): Promise<void> {
    const safetyCheck = detectRedFlags(userMessage);
    const emergency = isEmergency || safetyCheck.isEmergency;

    let responseText = '';

    if (emergency) {
      responseText =
        `[EMERGENCY_DETECTED] This is a critical medical emergency. Please take your pet to the nearest emergency veterinary hospital immediately.\n\n` +
        `**Immediate Triage Actions:**\n` +
        `1. **Seek Hands-on Emergency Care:** The symptoms you described indicate acute medical risk that cannot wait for an online appointment.\n` +
        `2. **Keep Your Pet Quiet and Calm:** Minimize movement, keep the room quiet, and avoid administering any human medications.\n` +
        `3. **Transport Safely:** Use a blanket or pet carrier to transport your pet safely to an open emergency veterinary hospital.\n\n` +
        `*Please contact your local emergency veterinary clinic now.*`;
    } else {
      responseText =
        `Thank you for reaching out. Based on the symptoms you've shared, here is an initial triage overview:\n\n` +
        `**What this might indicate:**\n` +
        `- Mild dietary indiscretion or minor transient digestive sensitivity.\n` +
        `- Early environmental or viral reaction that should be monitored closely.\n\n` +
        `**Safe Home Support Actions:**\n` +
        `1. **Hydration:** Ensure fresh, clean water is always accessible in small, frequent amounts.\n` +
        `2. **Rest:** Keep your companion in a comfortable, quiet indoor resting area.\n` +
        `3. **Monitor:** Observe appetite, energy levels, and bowel movements over the next 12–24 hours.\n\n` +
        `**When to Escalate:**\n` +
        `If you observe persistent vomiting, extreme lethargy, or refusal to drink water, please schedule a full telemedicine consultation or visit an in-person clinic.\n\n` +
        `*Reminder: Vetopia AI cannot prescribe medications or replace a physical veterinary examination.*`;
    }

    // Emit in small chunks to simulate streaming behavior
    const chunks = responseText.split(' ');
    for (let i = 0; i < chunks.length; i++) {
      if (options?.signal?.aborted) return;
      const chunk = (i === 0 ? '' : ' ') + chunks[i];
      handler.onChunk(chunk, emergency);
      if (process.env.NODE_ENV !== 'test') {
        // Small tick for streaming realism in dev/demo
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    if (!options?.signal?.aborted) {
      handler.onDone();
    }
  }
}

export const triageService = new GeminiTriageService();
