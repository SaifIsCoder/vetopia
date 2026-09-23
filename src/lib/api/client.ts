import { env } from '../../config/env';
import {
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ServerError,
  ValidationError,
  normalizeError,
} from './errors';
import { ApiResponse, RequestOptions } from './types';

export type TokenProvider = () => Promise<string | null>;

export class ApiClient {
  private baseUrl: string;
  private tokenProvider: TokenProvider | null = null;
  private defaultTimeoutMs: number;

  constructor(baseUrl: string = env.apiUrl, defaultTimeoutMs = 15000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  public setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider;
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const {
      params,
      body,
      headers: customHeaders,
      timeoutMs = this.defaultTimeoutMs,
      requiresAuth = true,
      ...fetchOptions
    } = options;

    let url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (requiresAuth && this.tokenProvider) {
      try {
        const token = await this.tokenProvider();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        // Token retrieval failure defaults to unauthenticated
        console.warn('Failed to retrieve authentication token', err);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        this.handleErrorResponse(response.status, data);
      }

      return data as ApiResponse<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      throw normalizeError(error);
    }
  }

  private handleErrorResponse(status: number, data: any): never {
    const message = data?.error?.message || data?.message || 'Request failed';
    const code = data?.error?.code || 'UNKNOWN_ERROR';
    const details = data?.error?.details;

    switch (status) {
      case 401:
        throw new AuthError(message);
      case 403:
        throw new ForbiddenError(message);
      case 404:
        throw new NotFoundError(message);
      case 400:
      case 422:
        throw new ValidationError(message, details);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServerError(message);
      default:
        throw new ApiError(message, status, code, details);
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
