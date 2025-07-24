import { defineConfig, devices } from '@playwright/test';

/**
 * TODO 앱 Playwright E2E 테스트 설정
 * 다양한 브라우저와 기기에서의 사용자 워크플로우를 검증합니다.
 */
export default defineConfig({
  // 테스트 파일 위치
  testDir: './e2e',
  
  // 테스트 실행 설정
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // 리포터 설정
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit-results.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // 전역 설정
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 뷰포트 설정
    viewport: { width: 1280, height: 720 },
    
    // 타임아웃 설정
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  // 프로젝트별 브라우저 설정
  projects: [
    // 데스크톱 브라우저
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // 모바일 브라우저
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // 태블릿
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },
  ],

  // 개발 서버 설정
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // 테스트 결과 디렉토리
  outputDir: 'test-results/',
  
  // 글로벌 설정
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});