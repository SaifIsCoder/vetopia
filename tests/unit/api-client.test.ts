import {
  ApiError,
  NetworkError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ServerError,
  normalizeError,
} from '../../src/lib/api/errors';
import { ApiClient } from '../../src/lib/api/client';

describe('API Error Handling and Normalization', () => {
  test('Instantiates distinct error subclasses with appropriate codes', () => {
    const authErr = new AuthError();
    expect(authErr.status).toBe(401);
    expect(authErr.code).toBe('UNAUTHORIZED');

    const forbiddenErr = new ForbiddenError();
    expect(forbiddenErr.status).toBe(403);
    expect(forbiddenErr.code).toBe('FORBIDDEN');

    const notFoundErr = new NotFoundError();
    expect(notFoundErr.status).toBe(404);
    expect(notFoundErr.code).toBe('NOT_FOUND');

    const validationErr = new ValidationError('Invalid email', [
      { field: 'email', issue: 'Invalid' },
    ]);
    expect(validationErr.status).toBe(422);
    expect(validationErr.details).toHaveLength(1);

    const serverErr = new ServerError();
    expect(serverErr.status).toBe(500);

    const netErr = new NetworkError();
    expect(netErr.status).toBe(0);
  });

  test('Normalizes unknown JavaScript exceptions into ApiError', () => {
    const genericErr = new Error('Standard failure');
    const normalized = normalizeError(genericErr);

    expect(normalized).toBeInstanceOf(ApiError);
    expect(normalized.message).toBe('Standard failure');
    expect(normalized.status).toBe(500);
  });

  test('Normalizes TypeError into NetworkError when message indicates network', () => {
    const typeErr = new TypeError('Network request failed');
    const normalized = normalizeError(typeErr);

    expect(normalized).toBeInstanceOf(NetworkError);
  });

  test('ApiClient constructs with base URL', () => {
    const client = new ApiClient('https://api.vetopia.com/api/v1/');
    expect(client).toBeDefined();
  });
});
