import { QueryClient } from '@tanstack/react-query';
import { AuthError, ForbiddenError, NotFoundError } from '../api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh
      gcTime: 1000 * 60 * 30, // 30 minutes cache retention
      retry: (failureCount, error) => {
        // Do not retry authorization or not-found errors
        if (
          error instanceof AuthError ||
          error instanceof ForbiddenError ||
          error instanceof NotFoundError
        ) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
