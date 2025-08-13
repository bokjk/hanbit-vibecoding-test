import {
  test,
  expect,
  Browser,
  Page,
  chromium,
  firefox,
  webkit,
} from "@playwright/test";

/**
 * 크로스 브라우저 호환성 테스트
 * Chrome, Firefox, Safari(WebKit) 브라우저에서의 동작 검증
 */

interface BrowserTestConfig {
  name: string;
  browser: Browser;
}

// 브라우저별 설정
const browsers: BrowserTestConfig[] = [];

test.beforeAll(async () => {
  // Chromium (Chrome)
  const chromiumBrowser = await chromium.launch();
  browsers.push({ name: "Chromium", browser: chromiumBrowser });

  // Firefox
  try {
    const firefoxBrowser = await firefox.launch();
    browsers.push({ name: "Firefox", browser: firefoxBrowser });
  } catch (error) {
    console.log("Firefox 브라우저를 사용할 수 없습니다:", error);
  }

  // WebKit (Safari)
  try {
    const webkitBrowser = await webkit.launch();
    browsers.push({ name: "WebKit", browser: webkitBrowser });
  } catch (error) {
    console.log("WebKit 브라우저를 사용할 수 없습니다:", error);
  }
});

test.afterAll(async () => {
  // 모든 브라우저 종료
  for (const { browser } of browsers) {
    await browser.close();
  }
});

/**
 * 브라우저별 기본 기능 테스트
 */
for (const browserConfig of browsers) {
  test.describe(`크로스 브라우저 테스트 - ${browserConfig.name}`, () => {
    let page: Page;

    test.beforeEach(async () => {
      const context = await browserConfig.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          browserConfig.name === "Firefox"
            ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0"
            : undefined,
      });
      page = await context.newPage();

      await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });
    });

    test.afterEach(async () => {
      await page.close();
    });

    test(`[${browserConfig.name}] 애플리케이션 초기 로딩`, async () => {
      console.log(`🌐 ${browserConfig.name}에서 초기 로딩 테스트`);

      // 1. 페이지 제목 확인
      await expect(page).toHaveTitle(/TaskFlow|TODO/);

      // 2. 헤더 요소 확인
      await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
      await expect(page.locator("text=TaskFlow")).toBeVisible();

      // 3. 대시보드 확인
      await expect(
        page.locator('[data-testid="todo-dashboard"]'),
      ).toBeVisible();

      // 4. 할 일 입력 폼 확인
      await expect(page.locator('[data-testid="todo-input"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="priority-select"]'),
      ).toBeVisible();
      await expect(page.locator('[data-testid="add-todo-btn"]')).toBeVisible();

      // 5. 초기 통계 확인
      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("0");

      console.log(`✅ ${browserConfig.name} 초기 로딩 검증 완료`);
    });

    test(`[${browserConfig.name}] 할 일 CRUD 기본 작업`, async () => {
      console.log(`🌐 ${browserConfig.name}에서 CRUD 작업 테스트`);

      // 1. 할 일 추가
      await page.fill(
        '[data-testid="todo-input"]',
        `${browserConfig.name} 테스트 할 일`,
      );
      await page.selectOption('[data-testid="priority-select"]', "high");
      await page.click('[data-testid="add-todo-btn"]');

      // 2. 할 일 목록에 표시 확인
      await expect(
        page.locator(`text=${browserConfig.name} 테스트 할 일`),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("1");

      // 3. 할 일 완료 처리
      const checkbox = page.locator(
        '[data-testid="todo-item"]:first-child input[type="checkbox"]',
      );
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(
        page.locator('[data-testid="stats-completed"] .text-2xl'),
      ).toHaveText("1");

      // 4. 할 일 편집
      const todoItem = page.locator('[data-testid="todo-item"]').first();
      await todoItem.hover();

      // 브라우저별 호버 동작 차이 고려
      await page.waitForTimeout(200);
      await todoItem.locator('[data-testid="edit-todo-btn"]').click();

      const editInput = todoItem.locator('[data-testid="edit-todo-input"]');
      await editInput.clear();
      await editInput.fill(`${browserConfig.name} 수정된 할 일`);
      await todoItem.locator('[data-testid="save-todo-btn"]').click();

      await expect(
        page.locator(`text=${browserConfig.name} 수정된 할 일`),
      ).toBeVisible();

      // 5. 할 일 삭제
      await todoItem.hover();
      await page.waitForTimeout(200);
      await todoItem.locator('[data-testid="delete-todo-btn"]').click();

      // 삭제 확인 대화상자 처리
      page.on("dialog", async (dialog) => {
        expect(dialog.type()).toBe("confirm");
        await dialog.accept();
      });

      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("0");

      console.log(`✅ ${browserConfig.name} CRUD 작업 검증 완료`);
    });

    test(`[${browserConfig.name}] 폼 검증 및 인터랙션`, async () => {
      console.log(`🌐 ${browserConfig.name}에서 폼 검증 테스트`);

      // 1. 빈 입력으로 제출 시도
      await page.click('[data-testid="add-todo-btn"]');
      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("0");

      // 2. 우선순위 선택 테스트
      await page.fill('[data-testid="todo-input"]', "우선순위 테스트");

      const priorityOptions = ["low", "medium", "high"];
      for (const priority of priorityOptions) {
        await page.selectOption('[data-testid="priority-select"]', priority);
        const selectedValue = await page
          .locator('[data-testid="priority-select"]')
          .inputValue();
        expect(selectedValue).toBe(priority);
      }

      // 3. 키보드 인터랙션 테스트
      await page.fill('[data-testid="todo-input"]', "키보드 테스트");
      await page.keyboard.press("Enter");
      await expect(page.locator("text=키보드 테스트")).toBeVisible();

      console.log(`✅ ${browserConfig.name} 폼 검증 완료`);
    });

    test(`[${browserConfig.name}] 검색 및 필터링`, async () => {
      console.log(`🌐 ${browserConfig.name}에서 검색/필터링 테스트`);

      // 1. 테스트 데이터 준비
      const testTasks = [
        { title: "중요한 회의", priority: "high" },
        { title: "일반 업무", priority: "medium" },
        { title: "간단한 작업", priority: "low" },
      ];

      for (const task of testTasks) {
        await page.fill('[data-testid="todo-input"]', task.title);
        await page.selectOption(
          '[data-testid="priority-select"]',
          task.priority,
        );
        await page.click('[data-testid="add-todo-btn"]');
      }

      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("3");

      // 2. 검색 테스트
      await page.fill('[data-testid="search-input"]', "회의");
      await expect(page.locator("text=중요한 회의")).toBeVisible();
      await expect(page.locator("text=일반 업무")).not.toBeVisible();

      // 3. 검색어 클리어
      await page.fill('[data-testid="search-input"]', "");
      await expect(page.locator("text=일반 업무")).toBeVisible();

      // 4. 우선순위 필터링
      await page.click('[data-testid="filter-high"]');
      await expect(page.locator("text=중요한 회의")).toBeVisible();
      await expect(page.locator("text=일반 업무")).not.toBeVisible();

      // 5. 전체 보기
      await page.click('[data-testid="filter-all"]');
      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("3");

      console.log(`✅ ${browserConfig.name} 검색/필터링 완료`);
    });

    test(`[${browserConfig.name}] 로컬스토리지 지속성`, async () => {
      console.log(`🌐 ${browserConfig.name}에서 데이터 지속성 테스트`);

      // 1. 할 일 추가
      await page.fill(
        '[data-testid="todo-input"]',
        `${browserConfig.name} 지속성 테스트`,
      );
      await page.selectOption('[data-testid="priority-select"]', "medium");
      await page.click('[data-testid="add-todo-btn"]');

      // 2. 완료 처리
      await page
        .locator('[data-testid="todo-item"]:first-child input[type="checkbox"]')
        .click();

      // 3. 페이지 새로고침
      await page.reload({ waitUntil: "networkidle" });

      // 4. 데이터 유지 확인
      await expect(
        page.locator(`text=${browserConfig.name} 지속성 테스트`),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("1");
      await expect(
        page.locator('[data-testid="stats-completed"] .text-2xl'),
      ).toHaveText("1");

      // 5. 체크박스 상태 확인
      const checkbox = page.locator(
        '[data-testid="todo-item"]:first-child input[type="checkbox"]',
      );
      await expect(checkbox).toBeChecked();

      console.log(`✅ ${browserConfig.name} 데이터 지속성 완료`);
    });
  });
}

/**
 * 브라우저별 성능 비교 테스트
 */
test.describe("브라우저별 성능 비교", () => {
  const performanceResults: Record<
    string,
    { loadTime: number; interactionTime: number }
  > = {};

  for (const { name, browser } of browsers) {
    test(`[${name}] 성능 측정`, async () => {
      console.log(`🚀 ${name} 성능 측정 시작`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      const page = await context.newPage();

      // 1. 페이지 로딩 시간 측정
      const loadStartTime = Date.now();
      await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
      const loadTime = Date.now() - loadStartTime;

      // 2. 인터랙션 응답 시간 측정
      const interactionStartTime = Date.now();
      await page.fill('[data-testid="todo-input"]', "성능 테스트");
      await page.click('[data-testid="add-todo-btn"]');
      await page.locator("text=성능 테스트").waitFor();
      const interactionTime = Date.now() - interactionStartTime;

      performanceResults[name] = { loadTime, interactionTime };

      console.log(`📊 ${name} 결과:`);
      console.log(`  - 로딩 시간: ${loadTime}ms`);
      console.log(`  - 인터랙션 시간: ${interactionTime}ms`);

      // 성능 기준 검증
      expect(loadTime).toBeLessThan(5000); // 5초 이내
      expect(interactionTime).toBeLessThan(1000); // 1초 이내

      await context.close();
    });
  }

  test("성능 비교 결과 요약", async () => {
    console.log("\n📈 브라우저별 성능 비교 요약:");
    console.table(performanceResults);

    // 가장 빠른 브라우저 찾기
    const fastest = Object.entries(performanceResults).reduce(
      (prev, [name, metrics]) => {
        const totalTime = metrics.loadTime + metrics.interactionTime;
        const prevTotal = prev.metrics.loadTime + prev.metrics.interactionTime;
        return totalTime < prevTotal ? { name, metrics } : prev;
      },
    );

    console.log(`🏆 가장 빠른 브라우저: ${fastest.name}`);

    // 모든 브라우저가 기본 성능 기준을 충족하는지 확인
    Object.entries(performanceResults).forEach(([browserName, metrics]) => {
      console.log(`🔍 ${browserName} 성능 기준 검증`);
      expect(metrics.loadTime).toBeLessThan(5000);
      expect(metrics.interactionTime).toBeLessThan(1000);
    });
  });
});

/**
 * 브라우저별 CSS 호환성 테스트
 */
test.describe("CSS 호환성 테스트", () => {
  for (const { name, browser } of browsers) {
    test(`[${name}] CSS 스타일 및 레이아웃`, async () => {
      console.log(`🎨 ${name} CSS 호환성 테스트`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      const page = await context.newPage();

      await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

      // 1. Flexbox 레이아웃 확인
      const header = page.locator('[data-testid="todo-header"]');
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox!.width).toBeGreaterThan(0);

      // 2. 그리드 레이아웃 확인 (대시보드)
      const dashboard = page.locator('[data-testid="todo-dashboard"]');
      const dashboardBox = await dashboard.boundingBox();
      expect(dashboardBox).not.toBeNull();
      expect(dashboardBox!.width).toBeGreaterThan(0);

      // 3. CSS 변수 및 커스텀 프로퍼티 확인
      const rootStyles = await page.evaluate(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        return {
          primary: styles.getPropertyValue("--primary"),
          background: styles.getPropertyValue("--background"),
        };
      });

      // CSS 변수가 제대로 적용되었는지 확인
      expect(rootStyles.primary).toBeTruthy();
      expect(rootStyles.background).toBeTruthy();

      // 4. 버튼 스타일 일관성 확인
      const addButton = page.locator('[data-testid="add-todo-btn"]');
      const buttonStyles = await addButton.evaluate((el) => {
        const styles = getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          padding: styles.padding,
        };
      });

      expect(buttonStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)"); // 투명하지 않음
      expect(buttonStyles.borderRadius).not.toBe("0px"); // 둥근 모서리

      console.log(`✅ ${name} CSS 호환성 검증 완료`);

      await context.close();
    });
  }
});

/**
 * 브라우저별 JavaScript API 호환성
 */
test.describe("JavaScript API 호환성", () => {
  for (const { name, browser } of browsers) {
    test(`[${name}] JavaScript API 지원`, async () => {
      console.log(`⚙️ ${name} JavaScript API 호환성 테스트`);

      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

      // 1. LocalStorage API 지원 확인
      const localStorageSupport = await page.evaluate(() => {
        try {
          localStorage.setItem("test", "value");
          const value = localStorage.getItem("test");
          localStorage.removeItem("test");
          return value === "value";
        } catch {
          return false;
        }
      });

      expect(localStorageSupport).toBe(true);

      // 2. JSON API 지원 확인
      const jsonSupport = await page.evaluate(() => {
        try {
          const obj = { test: "value" };
          const json = JSON.stringify(obj);
          const parsed = JSON.parse(json);
          return parsed.test === "value";
        } catch {
          return false;
        }
      });

      expect(jsonSupport).toBe(true);

      // 3. Array 메서드 지원 확인
      const arrayMethodsSupport = await page.evaluate(() => {
        const arr = [1, 2, 3];
        return {
          map: typeof arr.map === "function",
          filter: typeof arr.filter === "function",
          reduce: typeof arr.reduce === "function",
          find: typeof arr.find === "function",
        };
      });

      expect(arrayMethodsSupport.map).toBe(true);
      expect(arrayMethodsSupport.filter).toBe(true);
      expect(arrayMethodsSupport.reduce).toBe(true);
      expect(arrayMethodsSupport.find).toBe(true);

      // 4. ES6+ 기능 지원 확인
      const es6Support = await page.evaluate(() => {
        try {
          // Arrow functions
          const arrow = () => "test";

          // Template literals
          const template = `test ${arrow()}`;

          // Destructuring
          const { length } = [1, 2, 3];

          // Spread operator
          const spread = [...[1, 2, 3]];

          return (
            template === "test test" && length === 3 && spread.length === 3
          );
        } catch {
          return false;
        }
      });

      expect(es6Support).toBe(true);

      console.log(`✅ ${name} JavaScript API 호환성 검증 완료`);

      await context.close();
    });
  }
});
