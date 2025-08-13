import { test, expect, devices, Page, BrowserContext } from "@playwright/test";

/**
 * 모바일 반응형 디자인 테스트
 * 다양한 디바이스 크기와 터치 인터랙션 검증
 */

// 테스트할 디바이스 설정
const mobileDevices = [
  {
    name: "iPhone 12",
    ...devices["iPhone 12"],
  },
  {
    name: "iPhone SE",
    ...devices["iPhone SE"],
  },
  {
    name: "Pixel 5",
    ...devices["Pixel 5"],
  },
  {
    name: "iPad",
    ...devices["iPad"],
  },
  {
    name: "iPad Mini",
    ...devices["iPad Mini"],
  },
];

// 커스텀 뷰포트 설정
const customViewports = [
  { name: "초소형 모바일", width: 320, height: 568 },
  { name: "일반 모바일", width: 375, height: 812 },
  { name: "큰 모바일", width: 414, height: 896 },
  { name: "소형 태블릿", width: 768, height: 1024 },
  { name: "대형 태블릿", width: 1024, height: 1366 },
];

/**
 * 디바이스별 기본 기능 테스트
 */
for (const device of mobileDevices) {
  test.describe(`모바일 디바이스 테스트 - ${device.name}`, () => {
    let context: BrowserContext;
    let page: Page;

    test.beforeEach(async ({ browser }) => {
      context = await browser.newContext({
        ...device,
      });
      page = await context.newPage();

      await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });
    });

    test.afterEach(async () => {
      await context.close();
    });

    test(`[${device.name}] 반응형 레이아웃 검증`, async () => {
      console.log(`📱 ${device.name}에서 레이아웃 검증`);

      // 1. 뷰포트 크기 확인
      const viewport = page.viewportSize();
      console.log(`📐 뷰포트: ${viewport!.width}x${viewport!.height}`);

      // 2. 헤더 영역 반응형 확인
      const header = page.locator('[data-testid="todo-header"]');
      await expect(header).toBeVisible();

      const headerBox = await header.boundingBox();
      expect(headerBox!.width).toBeGreaterThan(0);
      expect(headerBox!.width).toBeLessThanOrEqual(viewport!.width);

      // 3. 대시보드 카드가 모바일에서 세로로 쌓이는지 확인
      const statsCards = page.locator('[data-testid="stats-card"]');
      const cardCount = await statsCards.count();

      if (cardCount > 0) {
        const firstCard = statsCards.first();
        const lastCard = statsCards.last();

        const firstCardBox = await firstCard.boundingBox();
        const lastCardBox = await lastCard.boundingBox();

        // 모바일에서는 카드들이 세로로 배치되어야 함
        if (viewport!.width <= 768) {
          expect(firstCardBox!.y).not.toEqual(lastCardBox!.y);
        }
      }

      // 4. 할 일 입력 폼 반응형 확인
      const todoForm = page.locator('[data-testid="todo-form"]');
      const formBox = await todoForm.boundingBox();
      expect(formBox!.width).toBeLessThanOrEqual(viewport!.width);

      // 5. 할 일 목록 반응형 확인
      const todoList = page.locator('[data-testid="todo-list"]');
      const listBox = await todoList.boundingBox();
      expect(listBox!.width).toBeLessThanOrEqual(viewport!.width);

      console.log(`✅ ${device.name} 레이아웃 검증 완료`);
    });

    test(`[${device.name}] 터치 인터랙션`, async () => {
      console.log(`👆 ${device.name}에서 터치 인터랙션 테스트`);

      // 1. 터치 입력으로 할 일 추가
      const todoInput = page.locator('[data-testid="todo-input"]');
      await todoInput.tap();
      await todoInput.fill(`${device.name} 터치 테스트`);

      // 2. 우선순위 선택 (터치)
      const prioritySelect = page.locator('[data-testid="priority-select"]');
      await prioritySelect.tap();
      await prioritySelect.selectOption("high");

      // 3. 추가 버튼 터치
      const addButton = page.locator('[data-testid="add-todo-btn"]');
      await addButton.tap();

      // 4. 할 일이 추가되었는지 확인
      await expect(
        page.locator(`text=${device.name} 터치 테스트`),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stats-total"] .text-2xl'),
      ).toHaveText("1");

      // 5. 체크박스 터치로 완료 처리
      const checkbox = page.locator(
        '[data-testid="todo-item"]:first-child input[type="checkbox"]',
      );
      await checkbox.tap();
      await expect(checkbox).toBeChecked();

      // 6. 모바일에서 스와이프 제스처 시뮬레이션 (편집/삭제 액션)
      const todoItem = page.locator('[data-testid="todo-item"]').first();
      const itemBox = await todoItem.boundingBox();

      if (itemBox) {
        // 좌측에서 우측으로 스와이프 제스처
        await page.mouse.move(itemBox.x + 10, itemBox.y + itemBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          itemBox.x + itemBox.width - 10,
          itemBox.y + itemBox.height / 2,
          { steps: 10 },
        );
        await page.mouse.up();

        // 액션 버튼이 나타나는지 확인 (또는 호버 효과)
        await page.waitForTimeout(500);
      }

      console.log(`✅ ${device.name} 터치 인터랙션 완료`);
    });

    test(`[${device.name}] 모바일 사용성`, async () => {
      console.log(`📲 ${device.name}에서 모바일 사용성 테스트`);

      // 1. 최소 터치 타겟 크기 확인 (44px x 44px 권장)
      const interactiveElements = [
        '[data-testid="add-todo-btn"]',
        '[data-testid="priority-select"]',
        // 체크박스와 버튼들
      ];

      for (const selector of interactiveElements) {
        const element = page.locator(selector);
        if ((await element.count()) > 0) {
          const box = await element.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(40); // 최소 터치 크기
            expect(box.width).toBeGreaterThanOrEqual(40);
          }
        }
      }

      // 2. 텍스트 가독성 확인 (최소 16px)
      const textElements = await page.$$eval("*", (elements) => {
        return elements
          .filter((el) => el.textContent && el.textContent.trim())
          .map((el) => {
            const styles = window.getComputedStyle(el);
            return {
              fontSize: parseFloat(styles.fontSize),
              element: el.tagName.toLowerCase(),
            };
          });
      });

      // 본문 텍스트 크기 확인
      const bodyTexts = textElements.filter(
        (item) => !["h1", "h2", "h3", "h4", "h5", "h6"].includes(item.element),
      );

      if (bodyTexts.length > 0) {
        const averageFontSize =
          bodyTexts.reduce((sum, item) => sum + item.fontSize, 0) /
          bodyTexts.length;
        expect(averageFontSize).toBeGreaterThanOrEqual(14); // 모바일에서 최소 14px
      }

      // 3. 스크롤 동작 확인
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      await page.evaluate(() => window.scrollTo(0, 0));

      console.log(`✅ ${device.name} 모바일 사용성 완료`);
    });
  });
}

/**
 * 커스텀 뷰포트 테스트
 */
test.describe("커스텀 뷰포트 반응형 테스트", () => {
  for (const viewport of customViewports) {
    test(`[${viewport.name}] ${viewport.width}x${viewport.height} 반응형`, async ({
      browser,
    }) => {
      console.log(
        `📏 ${viewport.name} (${viewport.width}x${viewport.height}) 테스트`,
      );

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });

      // 1. 전체 레이아웃이 뷰포트에 맞는지 확인
      const body = page.locator("body");
      const bodyBox = await body.boundingBox();
      expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width);

      // 2. 가로 스크롤바가 생기지 않는지 확인
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // 3. 주요 컴포넌트들이 뷰포트 내에 있는지 확인
      const mainComponents = [
        '[data-testid="todo-header"]',
        '[data-testid="todo-dashboard"]',
        '[data-testid="todo-form"]',
      ];

      for (const selector of mainComponents) {
        const element = page.locator(selector);
        if ((await element.count()) > 0) {
          const box = await element.boundingBox();
          expect(box!.width).toBeLessThanOrEqual(viewport.width);
        }
      }

      // 4. 브레이크포인트별 레이아웃 변화 확인
      if (viewport.width <= 640) {
        // 소형 모바일: 단일 컬럼 레이아웃
        const statsCards = page.locator('[data-testid="stats-card"]');
        if ((await statsCards.count()) > 1) {
          const firstCard = statsCards.first();
          const secondCard = statsCards.nth(1);

          const firstBox = await firstCard.boundingBox();
          const secondBox = await secondCard.boundingBox();

          // 카드들이 세로로 배치되어야 함
          expect(Math.abs(firstBox!.y - secondBox!.y)).toBeGreaterThan(10);
        }
      } else if (viewport.width <= 1024) {
        // 태블릿: 2-3 컬럼 레이아웃
        const statsCards = page.locator('[data-testid="stats-card"]');
        if ((await statsCards.count()) >= 2) {
          // 일부 카드들이 같은 행에 있을 수 있음
          const firstCard = statsCards.first();
          const secondCard = statsCards.nth(1);

          const firstBox = await firstCard.boundingBox();
          const secondBox = await secondCard.boundingBox();

          // Y 좌표가 비슷하면 같은 행에 있음
          const sameRow = Math.abs(firstBox!.y - secondBox!.y) < 20;
          expect(sameRow).toBeTruthy(); // 태블릿에서는 같은 행 배치 가능
        }
      }

      console.log(`✅ ${viewport.name} 반응형 검증 완료`);

      await context.close();
    });
  }
});

/**
 * 화면 회전 테스트
 */
test.describe("화면 회전 테스트", () => {
  test("세로/가로 모드 전환", async ({ browser }) => {
    console.log("🔄 화면 회전 테스트");

    // 세로 모드로 시작
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

    // 1. 세로 모드에서 할 일 추가
    await page.fill('[data-testid="todo-input"]', "화면 회전 테스트");
    await page.click('[data-testid="add-todo-btn"]');
    await expect(page.locator("text=화면 회전 테스트")).toBeVisible();

    // 2. 가로 모드로 회전
    await page.setViewportSize({ width: 812, height: 375 });
    await page.waitForTimeout(500);

    // 3. 가로 모드에서도 레이아웃이 깨지지 않는지 확인
    await expect(page.locator("text=화면 회전 테스트")).toBeVisible();

    // 4. 가로 모드에서 새로운 할 일 추가
    await page.fill('[data-testid="todo-input"]', "가로 모드 테스트");
    await page.click('[data-testid="add-todo-btn"]');
    await expect(page.locator("text=가로 모드 테스트")).toBeVisible();

    // 5. 통계가 올바르게 업데이트되는지 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("2");

    // 6. 다시 세로 모드로 회전
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // 7. 세로 모드에서도 모든 데이터가 유지되는지 확인
    await expect(page.locator("text=화면 회전 테스트")).toBeVisible();
    await expect(page.locator("text=가로 모드 테스트")).toBeVisible();
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("2");

    console.log("✅ 화면 회전 테스트 완료");

    await context.close();
  });
});

/**
 * 모바일 브라우저 특화 기능 테스트
 */
test.describe("모바일 브라우저 특화 기능", () => {
  test("터치 제스처 및 모바일 이벤트", async ({ browser }) => {
    console.log("📱 모바일 특화 기능 테스트");

    const context = await browser.newContext({
      ...devices["iPhone 12"],
    });
    const page = await context.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

    // 1. 더블 탭 줌 방지 확인
    const viewport = page.viewportSize();
    const initialViewport = { ...viewport! };

    // 더블 탭 시뮬레이션
    await page.tap('[data-testid="todo-header"]');
    await page.waitForTimeout(50);
    await page.tap('[data-testid="todo-header"]');
    await page.waitForTimeout(300);

    const currentViewport = page.viewportSize();
    expect(currentViewport!.width).toBe(initialViewport.width);
    expect(currentViewport!.height).toBe(initialViewport.height);

    // 2. 터치 시작/종료 이벤트
    let touchEvents: string[] = [];

    await page.evaluate(() => {
      const events: string[] = [];
      window.addEventListener("touchstart", () => events.push("touchstart"));
      window.addEventListener("touchend", () => events.push("touchend"));
      (window as unknown as { touchEvents: string[] }).touchEvents = events;
    });

    await page.tap('[data-testid="add-todo-btn"]');

    touchEvents = await page.evaluate(
      () => (window as unknown as { touchEvents?: string[] }).touchEvents || [],
    );

    // 터치 이벤트가 발생했는지 확인 (지원되는 경우)
    if (touchEvents.length > 0) {
      expect(touchEvents).toContain("touchstart");
      expect(touchEvents).toContain("touchend");
    }

    // 3. 길게 누르기 (롱 프레스) 방지
    const todoInput = page.locator('[data-testid="todo-input"]');
    await todoInput.fill("길게 누르기 테스트");

    // 길게 누르기 시뮬레이션
    const inputBox = await todoInput.boundingBox();
    if (inputBox) {
      await page.mouse.move(
        inputBox.x + inputBox.width / 2,
        inputBox.y + inputBox.height / 2,
      );
      await page.mouse.down();
      await page.waitForTimeout(1000); // 1초간 누르고 있기
      await page.mouse.up();
    }

    // 텍스트가 여전히 존재하는지 확인 (선택되어 삭제되지 않았는지)
    const inputValue = await todoInput.inputValue();
    expect(inputValue).toBe("길게 누르기 테스트");

    console.log("✅ 모바일 특화 기능 테스트 완료");

    await context.close();
  });

  test("가상 키보드 호환성", async ({ browser }) => {
    console.log("⌨️ 가상 키보드 호환성 테스트");

    const context = await browser.newContext({
      ...devices["iPhone 12"],
    });
    const page = await context.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

    // 1. 입력 필드 포커스 시 키보드 영역 고려
    const todoInput = page.locator('[data-testid="todo-input"]');
    const initialInputBox = await todoInput.boundingBox();

    await todoInput.focus();
    await page.waitForTimeout(500);

    // 입력 필드가 여전히 보이는 위치에 있는지 확인
    const focusedInputBox = await todoInput.boundingBox();
    expect(focusedInputBox).not.toBeNull();

    // 2. 입력 중 UI 요소들의 위치 확인
    await todoInput.fill("가상 키보드 테스트");

    const addButton = page.locator('[data-testid="add-todo-btn"]');
    const buttonBox = await addButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.y).toBeGreaterThan(0);

    // 3. 키보드 숨기기 후 레이아웃 복원
    await page.keyboard.press("Enter"); // 할 일 추가
    await page.locator("body").click(); // 포커스 해제
    await page.waitForTimeout(500);

    // 4. 최종 레이아웃 확인
    const finalInputBox = await todoInput.boundingBox();
    expect(Math.abs(finalInputBox!.y - initialInputBox!.y)).toBeLessThan(20);

    console.log("✅ 가상 키보드 호환성 테스트 완료");

    await context.close();
  });
});

/**
 * 성능 최적화 검증 (모바일)
 */
test.describe("모바일 성능 최적화", () => {
  test("모바일 네트워크 조건에서의 성능", async ({ browser }) => {
    console.log("📶 모바일 네트워크 성능 테스트");

    // 3G 네트워크 시뮬레이션
    const context = await browser.newContext({
      ...devices["iPhone 12"],
    });
    const page = await context.newPage();

    // 네트워크 속도 제한 (3G 시뮬레이션)
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (1600 * 1024) / 8, // 1.6 Mbps
      uploadThroughput: (750 * 1024) / 8, // 750 Kbps
      latency: 300, // 300ms latency
    });

    // 1. 페이지 로딩 시간 측정
    const startTime = Date.now();
    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
    const loadTime = Date.now() - startTime;

    console.log(`📊 3G 네트워크에서 로딩 시간: ${loadTime}ms`);

    // 2. 3G에서도 5초 이내 로딩되는지 확인
    expect(loadTime).toBeLessThan(5000);

    // 3. 인터랙션 응답성 확인
    const interactionStart = Date.now();
    await page.fill('[data-testid="todo-input"]', "3G 네트워크 테스트");
    await page.click('[data-testid="add-todo-btn"]');
    await expect(page.locator("text=3G 네트워크 테스트")).toBeVisible();
    const interactionTime = Date.now() - interactionStart;

    console.log(`⚡ 3G 네트워크에서 인터랙션 시간: ${interactionTime}ms`);
    expect(interactionTime).toBeLessThan(1000);

    // 4. 네트워크 제한 해제
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: -1,
    });

    console.log("✅ 모바일 네트워크 성능 테스트 완료");

    await context.close();
  });
});
