import { Page, expect } from '@playwright/test';
import { TestTodo } from '../fixtures/test-data';

/**
 * E2E 테스트용 헬퍼 함수들
 * 공통적으로 사용되는 테스트 로직을 추상화합니다.
 */

/**
 * 페이지 로드 대기 및 검증
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
  await expect(page.locator('[data-testid="todo-dashboard"]')).toBeVisible();
}

/**
 * 로컬스토리지에 테스트 데이터 시드
 */
export async function seedTestData(page: Page, todos: TestTodo[]) {
  await page.evaluate((todosData) => {
    const formattedTodos = todosData.map((todo, index) => ({
      id: `test-${index + 1}`,
      title: todo.title,
      priority: todo.priority,
      completed: todo.completed || false,
      createdAt: new Date(Date.now() - (index * 60000)).toISOString(), // 1분씩 차이
      updatedAt: new Date(Date.now() - (index * 60000)).toISOString()
    }));
    
    localStorage.setItem('todos', JSON.stringify(formattedTodos));
  }, todos);
  
  // 페이지 새로고침하여 데이터 로드
  await page.reload();
  await waitForPageLoad(page);
}

/**
 * 스크린샷 촬영 (테스트 실패 시)
 */
export async function captureScreenshot(page: Page, testName: string, step?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = step 
    ? `${testName}-${step}-${timestamp}.png`
    : `${testName}-${timestamp}.png`;
  
  await page.screenshot({
    path: `test-results/screenshots/${filename}`,
    fullPage: true
  });
}

/**
 * 브라우저 콘솔 에러 체크
 */
export async function checkConsoleErrors(page: Page) {
  const errors: string[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  return {
    getErrors: () => errors,
    hasErrors: () => errors.length > 0,
    clear: () => errors.length = 0
  };
}

/**
 * 네트워크 요청 모니터링
 */
export async function monitorNetworkRequests(page: Page) {
  const requests: Array<{ url: string; method: string; status?: number }> = [];
  
  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method()
    });
  });
  
  page.on('response', (response) => {
    const request = requests.find(req => req.url === response.url());
    if (request) {
      request.status = response.status();
    }
  });
  
  return {
    getRequests: () => requests,
    getFailedRequests: () => requests.filter(req => req.status && req.status >= 400),
    clear: () => requests.length = 0
  };
}

/**
 * 키보드 단축키 테스트
 */
export async function testKeyboardShortcuts(page: Page) {
  // Ctrl+Enter로 할 일 추가
  await page.locator('[data-testid="todo-input"]').fill('키보드 테스트');
  await page.keyboard.press('Control+Enter');
  
  // Escape로 편집 취소
  const firstTodo = page.locator('[data-testid="todo-item"]').first();
  await firstTodo.locator('[data-testid="edit-button"]').click();
  await page.keyboard.press('Escape');
}

/**
 * 접근성 검사
 */
export async function checkAccessibility(page: Page) {
  // 포커스 가능한 요소들 확인
  const focusableElements = await page.locator('button, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
  
  for (const element of focusableElements) {
    await element.focus();
    
    // 포커스 표시가 있는지 확인
    const focusVisible = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline !== 'none' || styles.boxShadow.includes('inset') || styles.border.includes('blue');
    });
    
    expect(focusVisible).toBeTruthy();
  }
}

/**
 * 성능 메트릭 수집
 */
export async function collectPerformanceMetrics(page: Page) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: paint.find(entry => entry.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
      networkTime: navigation.responseEnd - navigation.requestStart
    };
  });
  
  return metrics;
}

/**
 * 반응형 테스트 헬퍼
 */
export async function testResponsiveBreakpoints(page: Page, callback: () => Promise<void>) {
  const breakpoints = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 }
  ];
  
  for (const breakpoint of breakpoints) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.waitForTimeout(500); // 레이아웃 안정화 대기
    
    // 스크린샷 촬영
    await page.screenshot({
      path: `test-results/responsive/${breakpoint.name}.png`,
      fullPage: true
    });
    
    // 콜백 실행
    await callback();
  }
}

/**
 * 에러 바운더리 테스트
 */
export async function triggerErrorBoundary(page: Page) {
  // 의도적으로 JavaScript 에러 발생
  await page.evaluate(() => {
    // @ts-ignore
    window.triggerTestError = () => {
      throw new Error('Test error for error boundary');
    };
  });
  
  await page.evaluate(() => {
    // @ts-ignore
    window.triggerTestError();
  });
}

/**
 * 로딩 상태 테스트
 */
export async function testLoadingStates(page: Page) {
  // 네트워크 요청 차단
  await page.route('**/*', (route) => {
    setTimeout(() => route.continue(), 2000); // 2초 지연
  });
  
  // 로딩 스피너 확인
  await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  
  // 네트워크 차단 해제
  await page.unroute('**/*');
  
  // 로딩 완료 확인
  await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
}

/**
 * 애니메이션 완료 대기
 */
export async function waitForAnimations(page: Page) {
  await page.waitForFunction(() => {
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.animationPlayState === 'running' ||
          computedStyle.transitionProperty !== 'none') {
        return false;
      }
    }
    return true;
  });
}

/**
 * 다크 모드 테스트
 */
export async function testDarkMode(page: Page) {
  // 다크 모드 토글
  const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
  if (await darkModeToggle.isVisible()) {
    await darkModeToggle.click();
    
    // 다크 모드 클래스 확인
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // 다크 모드 스크린샷
    await page.screenshot({
      path: 'test-results/dark-mode.png',
      fullPage: true
    });
    
    // 라이트 모드로 되돌리기
    await darkModeToggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  }
}