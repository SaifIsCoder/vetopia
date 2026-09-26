import { ApiErrorDetail } from './types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(message: string, status = 500, code = 'UNKNOWN_ERROR', details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failed. Please check your internet.') {
    super(message, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Authentication required. Please sign in again.') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'AuthError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to access this resource.') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Requested resource was not found.') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Please check the information provided.', details?: ApiErrorDetail[]) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Slot just taken. Please select another time.') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ServerError extends ApiError {
  constructor(message = 'A server error occurred. Please try again later.') {
    super(message, 500, 'SERVER_ERROR');
    this.name = 'ServerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes('Network')) {
    return new NetworkError();
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new NetworkError('Request timed out. Please try again.');
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500, 'UNKNOWN_ERROR');
  }

  return new ApiError('An unexpected error occurred.', 500, 'UNKNOWN_ERROR');
}
