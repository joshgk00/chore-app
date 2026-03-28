import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'shared',
      globals: true,
      environment: 'node',
      include: ['packages/shared/tests/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'server',
      globals: true,
      environment: 'node',
      setupFiles: ['packages/server/tests/setup.ts'],
      include: ['packages/server/tests/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'client',
      globals: true,
      environment: 'jsdom',
      setupFiles: ['packages/client/tests/setup.ts'],
      include: ['packages/client/tests/**/*.test.{ts,tsx}'],
    },
  },
]);
