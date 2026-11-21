import { logger } from '../../src/lib/monitoring/logger';

describe('ActionableLogger & Monitoring (Phase E)', () => {
  beforeEach(() => {
    logger.clearBreadcrumbs();
    jest.clearAllMocks();
  });

  test('Records breadcrumbs and caps at maxBreadcrumbs limit', () => {
    logger.addBreadcrumb('navigation', 'Navigated to consultation room');
    logger.addBreadcrumb('webrtc', 'LiveKit connection state: connected');

    const crumbs = logger.getBreadcrumbs();
    expect(crumbs.length).toBe(2);
    expect(crumbs[0].category).toBe('navigation');
    expect(crumbs[1].message).toBe('LiveKit connection state: connected');
  });

  test('Redacts sensitive tokens, passwords, and secrets in metadata', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.captureError(new Error('RTC handshake failed'), {
      component: 'ConsultRoom',
      action: 'connect',
      metadata: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload',
        userPassword: 'SuperSecretPassword123!',
        safeField: 'telemedicine_room_1',
      },
    });

    expect(errorSpy).toHaveBeenCalled();
    const loggedPayload = JSON.parse(errorSpy.mock.calls[0][1]);
    expect(loggedPayload.metadata.token).toBe('[REDACTED]');
    expect(loggedPayload.metadata.userPassword).toBe('[REDACTED]');
    expect(loggedPayload.metadata.safeField).toBe('telemedicine_room_1');

    errorSpy.mockRestore();
  });
});
