/**
 * Actionable Monitoring & Error Logging Infrastructure (SRS NFR-REL / MVP Production Readiness)
 * Vetopia Mobile
 */

import { Platform } from 'react-native';
import { env } from '../../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Breadcrumb {
  category: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

class ActionableLogger {
  private breadcrumbs: Breadcrumb[] = [];
  private readonly maxBreadcrumbs = 30;

  /**
   * Records a user or system lifecycle breadcrumb for crash diagnostics
   */
  public addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    const crumb: Breadcrumb = {
      category,
      message,
      timestamp: new Date().toISOString(),
      data: data ? this.sanitizeData(data) : undefined,
    };

    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (env.isDevelopment) {
      console.info(`🔍 [DEBUG] ${message}`, context ? this.sanitizeData(context) : '');
    }
  }

  public info(message: string, context?: Record<string, unknown>): void {
    console.info(`ℹ️ [INFO] ${message}`, context ? this.sanitizeData(context) : '');
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`⚠️ [WARN] ${message}`, context ? this.sanitizeData(context) : '');
  }

  /**
   * Captures an error with breadcrumbs and contextual diagnosis
   */
  public captureError(
    error: Error | unknown,
    context?: {
      component?: string;
      action?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const payload = {
      message: errorObj.message,
      name: errorObj.name,
      stack: errorObj.stack,
      platform: Platform.OS,
      environment: env.appEnv,
      component: context?.component,
      action: context?.action,
      metadata: context?.metadata ? this.sanitizeData(context.metadata) : undefined,
      recentBreadcrumbs: [...this.breadcrumbs],
      timestamp: new Date().toISOString(),
    };

    console.error('🚨 [ActionableLogger.captureError]', JSON.stringify(payload, null, 2));

    // When third-party crash reporting SDKs (e.g. Sentry or Bugsnag) are linked:
    // Sentry.captureException(errorObj, { extra: payload });
  }

  /**
   * Sanitizes sensitive fields (tokens, passwords, secrets, PII) before recording or logging
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const SENSITIVE_KEYS = [
      'password',
      'token',
      'secret',
      'access_token',
      'refresh_token',
      'authorization',
      'apikey',
      'anonkey',
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}

export const logger = new ActionableLogger();
