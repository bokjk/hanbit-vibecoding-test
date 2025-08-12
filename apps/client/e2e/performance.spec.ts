import { test, expect } from "@playwright/test";
import { TodoPage } from "./page-objects/todo-page";
import { generateLargeTodoList } from "./fixtures/test-data";
import {
  collectPerformanceMetrics,
  collectDetailedPerformanceMetrics,
} from "./helpers/test-helpers";

test.describe("성능 테스트", () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
  });

  test("초기 페이지 로드 성능 및 Core Web Vitals", async ({ page }) => {
    const startTime = Date.now();

    await todoPage.goto();

    const loadTime = Date.now() - startTime;

    // 기본 로드 시간 확인 (3초 이내)
    expect(loadTime).toBeLessThan(3000);

    // Core Web Vitals 메트릭 수집
    const metrics = await collectPerformanceMetrics(page);

    console.log("Core Web Vitals:", {
      LCP: `${metrics.lcp}ms`,
      FCP: `${metrics.fcp}ms`,
      CLS: metrics.cls,
      TTFB: `${metrics.ttfb}ms`,
    });

    // Core Web Vitals 기준 검증
    expect(metrics.fcp).toBeLessThan(1800); // FCP < 1.8s (Good)
    expect(metrics.lcp).toBeLessThan(2500); // LCP < 2.5s (Good)
    expect(metrics.cls).toBeLessThan(0.1); // CLS < 0.1 (Good)
    expect(metrics.ttfb).toBeLessThan(800); // TTFB < 800ms (Good)
    expect(metrics.domContentLoaded).toBeLessThan(1000); // DOM 준비 < 1초
  });

  test("상세 성능 분석", async ({ page }) => {
    await todoPage.goto();

    // 상세 성능 메트릭 수집
    const detailedMetrics = await collectDetailedPerformanceMetrics(page);

    console.log("상세 성능 분석:", {
      timing: detailedMetrics.timing,
      memory: detailedMetrics.memory,
      resources: detailedMetrics.resources,
      connection: detailedMetrics.connection,
    });

    // 성능 기준 검증
    expect(detailedMetrics.timing.ttfb).toBeLessThan(800); // TTFB < 800ms
    expect(detailedMetrics.timing.totalTime).toBeLessThan(3000); // 전체 로드 < 3s
    expect(detailedMetrics.resources.totalRequests).toBeLessThan(25); // 요청 수 < 25개

    // 메모리 사용량 검증 (Chrome에서만)
    if (detailedMetrics.memory) {
      expect(detailedMetrics.memory.usedJSHeapSize).toBeLessThan(
        50 * 1024 * 1024,
      ); // < 50MB
    }
  });

  test("대량 데이터 렌더링 성능", async ({ page }) => {
    // 100개의 테스트 할 일 생성
    const largeTodoList = generateLargeTodoList(100);

    await todoPage.goto();
    await todoPage.clearStorage();

    // 대량 데이터 시드
    await page.evaluate((todos) => {
      localStorage.setItem("todos", JSON.stringify(todos));
    }, largeTodoList);

    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState("networkidle");

    const renderTime = Date.now() - startTime;

    // 대량 데이터도 5초 이내 렌더링
    expect(renderTime).toBeLessThan(5000);

    // 모든 할 일이 렌더링되었는지 확인
    const todoItems = await page.locator('[data-testid="todo-item"]').count();
    expect(todoItems).toBe(100);
  });

  test("검색 성능", async ({ page }) => {
    // 1000개의 테스트 할 일 생성
    const largeTodoList = generateLargeTodoList(1000);

    await todoPage.goto();
    await todoPage.clearStorage();

    // 대량 데이터 시드
    await page.evaluate((todos) => {
      localStorage.setItem("todos", JSON.stringify(todos));
    }, largeTodoList);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // 검색 성능 측정
    const startTime = Date.now();
    await todoPage.search("성능");

    // 검색 결과가 나타날 때까지 대기
    await page.waitForSelector('[data-testid="todo-item"]', { timeout: 2000 });

    const searchTime = Date.now() - startTime;

    // 검색은 2초 이내 완료 (현실적인 임계값)
    expect(searchTime).toBeLessThan(2000);
  });

  test("필터링 성능", async ({ page }) => {
    const largeTodoList = generateLargeTodoList(500);

    await todoPage.goto();
    await todoPage.clearStorage();

    await page.evaluate((todos) => {
      localStorage.setItem("todos", JSON.stringify(todos));
    }, largeTodoList);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // 필터링 성능 측정
    const startTime = Date.now();
    await todoPage.applyFilter("completed");

    await page.waitForTimeout(100); // 필터링 완료 대기

    const filterTime = Date.now() - startTime;

    // 필터링은 500ms 이내 완료
    expect(filterTime).toBeLessThan(500);
  });

  test("메모리 사용량 모니터링", async ({ page }) => {
    await todoPage.goto();

    // 초기 메모리 사용량
    const initialMemory = await page.evaluate(() => {
      if ("memory" in performance) {
        // @ts-expect-error: Chrome-specific memory API
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // 대량 할 일 추가
    for (let i = 0; i < 50; i++) {
      await todoPage.addTodo(`메모리 테스트 ${i}`, "medium");
    }

    // 최종 메모리 사용량
    const finalMemory = await page.evaluate(() => {
      if ("memory" in performance) {
        // @ts-expect-error: Chrome-specific memory API
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    const memoryIncrease = finalMemory - initialMemory;

    // 메모리 증가량이 10MB 이하인지 확인
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

    console.log(
      `메모리 증가량: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
    );
  });

  test("네트워크 요청 최적화", async ({ page }) => {
    const requests: string[] = [];

    page.on("request", (request) => {
      requests.push(request.url());
    });

    await todoPage.goto();

    // 불필요한 요청이 없는지 확인
    const staticAssetRequests = requests.filter(
      (url) =>
        url.includes(".js") || url.includes(".css") || url.includes(".png"),
    );

    // 정적 자산 요청이 적절한 수준인지 확인 (25개 이하 - 개발 환경 고려)
    expect(staticAssetRequests.length).toBeLessThan(25);

    console.log("네트워크 요청 수:", requests.length);
    console.log("정적 자산 요청 수:", staticAssetRequests.length);
  });
});
