import { test, expect } from '@playwright/test';
import { TodoPage } from './page-objects/todo-page';
import { generateLargeTodoList } from './fixtures/test-data';
import { collectPerformanceMetrics } from './helpers/test-helpers';

test.describe('성능 테스트', () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
  });

  test('초기 페이지 로드 성능', async ({ page }) => {
    const startTime = Date.now();
    
    await todoPage.goto();
    
    const loadTime = Date.now() - startTime;
    
    // 3초 이내 로드 확인
    expect(loadTime).toBeLessThan(3000);
    
    // 성능 메트릭 수집
    const metrics = await collectPerformanceMetrics(page);
    
    console.log('성능 메트릭:', metrics);
    
    // Core Web Vitals 기준
    expect(metrics.firstContentfulPaint).toBeLessThan(2500); // 2.5초
    expect(metrics.domContentLoaded).toBeLessThan(1000); // 1초
  });

  test('대량 데이터 렌더링 성능', async ({ page }) => {
    // 100개의 테스트 할 일 생성
    const largeTodoList = generateLargeTodoList(100);
    
    await todoPage.goto();
    await todoPage.clearStorage();
    
    // 대량 데이터 시드
    await page.evaluate((todos) => {
      localStorage.setItem('todos', JSON.stringify(todos));
    }, largeTodoList);
    
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const renderTime = Date.now() - startTime;
    
    // 대량 데이터도 5초 이내 렌더링
    expect(renderTime).toBeLessThan(5000);
    
    // 모든 할 일이 렌더링되었는지 확인
    const todoItems = await page.locator('[data-testid="todo-item"]').count();
    expect(todoItems).toBe(100);
  });

  test('검색 성능', async ({ page }) => {
    // 1000개의 테스트 할 일 생성
    const largeTodoList = generateLargeTodoList(1000);
    
    await todoPage.goto();
    await todoPage.clearStorage();
    
    // 대량 데이터 시드
    await page.evaluate((todos) => {
      localStorage.setItem('todos', JSON.stringify(todos));
    }, largeTodoList);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 검색 성능 측정
    const startTime = Date.now();
    await todoPage.search('성능');
    
    // 검색 결과가 나타날 때까지 대기
    await page.waitForSelector('[data-testid="todo-item"]', { timeout: 2000 });
    
    const searchTime = Date.now() - startTime;
    
    // 검색은 1초 이내 완료
    expect(searchTime).toBeLessThan(1000);
  });

  test('필터링 성능', async ({ page }) => {
    const largeTodoList = generateLargeTodoList(500);
    
    await todoPage.goto();
    await todoPage.clearStorage();
    
    await page.evaluate((todos) => {
      localStorage.setItem('todos', JSON.stringify(todos));
    }, largeTodoList);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 필터링 성능 측정
    const startTime = Date.now();
    await todoPage.applyFilter('completed');
    
    await page.waitForTimeout(100); // 필터링 완료 대기
    
    const filterTime = Date.now() - startTime;
    
    // 필터링은 500ms 이내 완료
    expect(filterTime).toBeLessThan(500);
  });

  test('메모리 사용량 모니터링', async ({ page }) => {
    await todoPage.goto();
    
    // 초기 메모리 사용량
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        // @ts-ignore
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // 대량 할 일 추가
    for (let i = 0; i < 50; i++) {
      await todoPage.addTodo(`메모리 테스트 ${i}`, 'medium');
    }
    
    // 최종 메모리 사용량
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        // @ts-ignore
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    const memoryIncrease = finalMemory - initialMemory;
    
    // 메모리 증가량이 10MB 이하인지 확인
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    
    console.log(`메모리 증가량: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });

  test('네트워크 요청 최적화', async ({ page }) => {
    const requests: string[] = [];
    
    page.on('request', (request) => {
      requests.push(request.url());
    });
    
    await todoPage.goto();
    
    // 불필요한 요청이 없는지 확인
    const staticAssetRequests = requests.filter(url => 
      url.includes('.js') || url.includes('.css') || url.includes('.png')
    );
    
    // 정적 자산 요청이 적절한 수준인지 확인 (10개 이하)
    expect(staticAssetRequests.length).toBeLessThan(10);
    
    console.log('네트워크 요청 수:', requests.length);
    console.log('정적 자산 요청 수:', staticAssetRequests.length);
  });
});