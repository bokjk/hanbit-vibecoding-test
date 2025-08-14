import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Contract Testing 전용 Vitest 설정
 */
export default defineConfig({
  test: {
    name: 'Contract Tests',
    globals: true,
    environment: 'node',
    include: ['**/__tests__/contract/**/*.test.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__tests__/unit/**',
      '**/__tests__/integration/**',
    ],
    setupFiles: ['__tests__/contract/setup.ts'],
    testTimeout: 30000, // Contract 테스트는 시간이 더 오래 걸릴 수 있음
    hookTimeout: 10000,
    // Contract 테스트 전용 리포터
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/contract-test-results.json',
    },
    coverage: {
      enabled: false, // Contract 테스트에서는 커버리지 수집 비활성화
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './lambda'),
      '@/types': path.resolve(__dirname, '../../packages/types/src'),
    },
  },
  define: {
    // Contract 테스트 환경 변수
    'process.env.NODE_ENV': '"test"',
    'process.env.IS_CONTRACT_TEST': '"true"',
  },
});
