import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./lambda/__tests__/setup.ts'],
    testTimeout: 10000, // 10초 타임아웃 (DynamoDB 테스트 고려)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'infrastructure/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        '**/index.ts', // 핸들러 인덱스 파일들
        '**/constants.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        './lambda/services/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './lambda/repositories/': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        './lambda/utils/': {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './lambda'),
      '@/types': resolve(__dirname, './lambda/types'),
      '@/services': resolve(__dirname, './lambda/services'),
      '@/repositories': resolve(__dirname, './lambda/repositories'),
      '@/utils': resolve(__dirname, './lambda/utils'),
      '@/handlers': resolve(__dirname, './lambda/handlers'),
      '@/middleware': resolve(__dirname, './lambda/middleware'),
    },
  },
});
