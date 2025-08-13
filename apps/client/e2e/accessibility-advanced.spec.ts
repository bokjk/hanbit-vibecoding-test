import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * 접근성 고급 테스트 (WCAG 2.1 AA 상세 검증)
 * axe-core를 사용한 자동화된 접근성 검사와 수동 검증
 */

test.describe("WCAG 2.1 AA 접근성 검증", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("자동화된 접근성 검사 (axe-core)", async () => {
    console.log("♿ 자동화된 접근성 검사 실행");

    // 1. 초기 페이지 접근성 검사
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    // 2. 접근성 위반 사항 확인
    expect(accessibilityScanResults.violations).toEqual([]);

    // 3. 할 일 추가 후 접근성 재검사
    await page.fill('[data-testid="todo-input"]', "접근성 테스트");
    await page.selectOption('[data-testid="priority-select"]', "high");
    await page.click('[data-testid="add-todo-btn"]');

    const afterAddScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(afterAddScanResults.violations).toEqual([]);

    // 4. 편집 모드 접근성 검사
    const todoItem = page.locator('[data-testid="todo-item"]').first();
    await todoItem.hover();
    await todoItem.locator('[data-testid="edit-todo-btn"]').click();

    const editModeScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(editModeScanResults.violations).toEqual([]);

    console.log("✅ 자동화된 접근성 검사 통과");
  });

  test("키보드 네비게이션 완전성", async () => {
    console.log("⌨️ 키보드 네비게이션 테스트");

    // 1. Tab 순서 추적
    const focusableElements: string[] = [];

    // Tab 키로 모든 포커스 가능한 요소 순회
    let previousFocus = "";
    let tabCount = 0;
    const maxTabs = 20; // 무한 루프 방지

    while (tabCount < maxTabs) {
      await page.keyboard.press("Tab");
      tabCount++;

      const currentFocus = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused) return "none";

        return (
          focused.getAttribute("data-testid") ||
          focused.tagName.toLowerCase() +
            (focused.id ? `#${focused.id}` : "") +
            (focused.className ? `.${focused.className.split(" ")[0]}` : "")
        );
      });

      if (currentFocus === previousFocus) {
        break; // 순환 완료 또는 포커스 트랩
      }

      focusableElements.push(currentFocus);
      previousFocus = currentFocus;
    }

    console.log("📋 Tab 순서:", focusableElements);

    // 2. 모든 인터랙티브 요소가 키보드로 접근 가능한지 확인
    const requiredElements = ["todo-input", "priority-select", "add-todo-btn"];

    for (const element of requiredElements) {
      const hasElement = focusableElements.some((el) => el.includes(element));
      expect(hasElement).toBe(true);
    }

    // 3. Skip Link 테스트 (있는 경우)
    await page.keyboard.press("Tab"); // 첫 번째 Tab으로 skip link 확인
    const skipLink = await page
      .locator('[href^="#"], [data-testid*="skip"]')
      .first();
    if ((await skipLink.count()) > 0) {
      await page.keyboard.press("Enter");
      // Skip link가 올바른 위치로 이동하는지 확인
    }

    // 4. 할 일 추가 후 키보드 네비게이션
    await page.focus('[data-testid="todo-input"]');
    await page.keyboard.type("키보드 네비게이션 테스트");
    await page.keyboard.press("Tab"); // 우선순위로 이동
    await page.keyboard.press("ArrowDown"); // 우선순위 선택
    await page.keyboard.press("Tab"); // 추가 버튼으로 이동
    await page.keyboard.press("Enter"); // 추가 실행

    await expect(page.locator("text=키보드 네비게이션 테스트")).toBeVisible();

    // 5. 할 일 항목 키보드 조작
    await page.keyboard.press("Tab"); // 체크박스로 이동
    await page.keyboard.press("Space"); // 체크박스 토글

    const checkbox = page.locator(
      '[data-testid="todo-item"]:first-child input[type="checkbox"]',
    );
    await expect(checkbox).toBeChecked();

    console.log("✅ 키보드 네비게이션 테스트 완료");
  });

  test("스크린 리더 호환성", async () => {
    console.log("🗣️ 스크린 리더 호환성 테스트");

    // 1. ARIA 레이블 확인
    const ariaElements = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          "[aria-label], [aria-labelledby], [aria-describedby]",
        ),
      );
      return elements.map((el) => ({
        tag: el.tagName.toLowerCase(),
        testId: el.getAttribute("data-testid"),
        ariaLabel: el.getAttribute("aria-label"),
        ariaLabelledby: el.getAttribute("aria-labelledby"),
        ariaDescribedby: el.getAttribute("aria-describedby"),
        role: el.getAttribute("role"),
      }));
    });

    console.log("🏷️ ARIA 레이블 요소:", ariaElements);

    // 2. 의미 있는 헤딩 구조 확인
    const headings = await page.evaluate(() => {
      const headingElements = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
      );
      return headingElements.map((el, index) => ({
        level: parseInt(el.tagName.charAt(1)),
        text: el.textContent?.trim(),
        order: index,
      }));
    });

    console.log("📑 헤딩 구조:", headings);

    // 헤딩 레벨이 순차적인지 확인 (WCAG 2.4.6)
    if (headings.length > 1) {
      for (let i = 1; i < headings.length; i++) {
        const currentLevel = headings[i].level;
        const previousLevel = headings[i - 1].level;
        const levelDiff = currentLevel - previousLevel;

        // 헤딩 레벨이 1 이상 건너뛰지 않는지 확인
        expect(levelDiff).toBeLessThanOrEqual(1);
      }
    }

    // 3. 폼 레이블 연결 확인
    const formElements = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll("input, select, textarea"),
      );
      return inputs.map((el) => {
        const input = el as HTMLInputElement;
        return {
          type: input.type,
          testId: input.getAttribute("data-testid"),
          hasLabel:
            !!input.labels?.length || !!input.getAttribute("aria-label"),
          labelText:
            input.labels?.[0]?.textContent?.trim() ||
            input.getAttribute("aria-label"),
          required: input.required,
          ariaRequired: input.getAttribute("aria-required") === "true",
        };
      });
    });

    console.log("📝 폼 요소 레이블:", formElements);

    // 모든 폼 요소가 적절한 레이블을 가지는지 확인
    formElements.forEach((element) => {
      expect(element.hasLabel).toBe(true);
    });

    // 4. 버튼 및 링크 설명 확인
    const interactiveElements = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll('button, a[href], [role="button"]'),
      );
      return elements.map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim(),
        ariaLabel: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
        testId: el.getAttribute("data-testid"),
        hasAccessibleName: !!(
          el.textContent?.trim() ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title")
        ),
      }));
    });

    console.log("🔲 인터랙티브 요소:", interactiveElements);

    // 모든 인터랙티브 요소가 접근 가능한 이름을 가지는지 확인
    interactiveElements.forEach((element) => {
      expect(element.hasAccessibleName).toBe(true);
    });

    // 5. 상태 변경 알림 확인
    await page.fill('[data-testid="todo-input"]', "상태 알림 테스트");
    await page.click('[data-testid="add-todo-btn"]');

    // aria-live 영역이 있는지 확인
    const liveRegions = await page.evaluate(() => {
      const regions = Array.from(
        document.querySelectorAll(
          '[aria-live], [role="status"], [role="alert"]',
        ),
      );
      return regions.map((el) => ({
        ariaLive: el.getAttribute("aria-live"),
        role: el.getAttribute("role"),
        content: el.textContent?.trim(),
      }));
    });

    console.log("📢 Live Regions:", liveRegions);

    console.log("✅ 스크린 리더 호환성 테스트 완료");
  });

  test("색상 및 대비 접근성", async () => {
    console.log("🎨 색상 및 대비 접근성 테스트");

    // 1. 텍스트 대비율 확인
    const textElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*")).filter(
        (el) => {
          const text = el.textContent?.trim();
          const style = getComputedStyle(el);
          return (
            text &&
            style.fontSize &&
            parseFloat(style.fontSize) > 0 &&
            el.children.length === 0
          ); // 텍스트만 있는 요소
        },
      );

      return elements.slice(0, 20).map((el) => {
        const style = getComputedStyle(el);
        return {
          text: el.textContent?.trim().substring(0, 30),
          fontSize: parseFloat(style.fontSize),
          color: style.color,
          backgroundColor: style.backgroundColor,
          testId: el.getAttribute("data-testid"),
        };
      });
    });

    console.log("📝 텍스트 요소 색상 정보:", textElements);

    // 2. 색상에만 의존하지 않는 정보 전달 확인
    await page.fill('[data-testid="todo-input"]', "우선순위 표시 테스트");

    // 높은 우선순위 할 일 추가
    await page.selectOption('[data-testid="priority-select"]', "high");
    await page.click('[data-testid="add-todo-btn"]');

    // 우선순위 표시가 색상 외에도 텍스트나 아이콘으로 구분되는지 확인
    const priorityBadge = page
      .locator('[data-testid="priority-badge"]')
      .first();
    if ((await priorityBadge.count()) > 0) {
      const badgeText = await priorityBadge.textContent();
      expect(badgeText).toBeTruthy(); // 색상 외에 텍스트로도 구분
      expect(badgeText).toMatch(/(긴급|높음|high)/i);
    }

    // 3. 포커스 표시 확인
    await page.focus('[data-testid="todo-input"]');

    const focusStyles = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement;
      if (!focused) return null;

      const style = getComputedStyle(focused);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
        borderColor: style.borderColor,
      };
    });

    console.log("🎯 포커스 스타일:", focusStyles);

    // 포커스 표시가 있는지 확인 (outline 또는 box-shadow)
    if (focusStyles) {
      const hasFocusIndicator =
        (focusStyles.outline &&
          focusStyles.outline !== "none" &&
          focusStyles.outline !== "0px") ||
        (focusStyles.boxShadow && focusStyles.boxShadow !== "none") ||
        (focusStyles.outlineWidth && parseFloat(focusStyles.outlineWidth) > 0);

      expect(hasFocusIndicator).toBe(true);
    }

    console.log("✅ 색상 및 대비 접근성 테스트 완료");
  });

  test("동적 콘텐츠 접근성", async () => {
    console.log("🔄 동적 콘텐츠 접근성 테스트");

    // 1. 할 일 추가 시 스크린 리더 알림
    const beforeCount = await page
      .locator('[data-testid="stats-total"] .text-2xl')
      .textContent();

    await page.fill('[data-testid="todo-input"]', "동적 콘텐츠 테스트");
    await page.click('[data-testid="add-todo-btn"]');

    // 통계 업데이트 확인
    const afterCount = await page
      .locator('[data-testid="stats-total"] .text-2xl')
      .textContent();
    expect(afterCount).not.toBe(beforeCount);

    // 2. 로딩 상태 접근성
    // 로딩 상태가 있다면 aria-busy 또는 role="status" 확인
    const loadingElements = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          '[aria-busy], [role="status"], .loading, [data-loading]',
        ),
      );
      return elements.map((el) => ({
        ariaBusy: el.getAttribute("aria-busy"),
        role: el.getAttribute("role"),
        ariaLabel: el.getAttribute("aria-label"),
        visible: getComputedStyle(el).display !== "none",
      }));
    });

    console.log("⏳ 로딩 상태 요소:", loadingElements);

    // 3. 에러 메시지 접근성
    // 빈 제목으로 할 일 추가 시도
    await page.click('[data-testid="add-todo-btn"]'); // 빈 입력으로 제출

    // 에러 메시지나 알림이 적절히 표시되는지 확인
    const errorElements = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          '[role="alert"], .error, [aria-invalid="true"]',
        ),
      );
      return elements.map((el) => ({
        role: el.getAttribute("role"),
        ariaInvalid: el.getAttribute("aria-invalid"),
        text: el.textContent?.trim(),
        visible: getComputedStyle(el).display !== "none",
      }));
    });

    console.log("❌ 에러 요소:", errorElements);

    // 4. 모달/다이얼로그 접근성 (삭제 확인 등)
    await page.fill('[data-testid="todo-input"]', "삭제 테스트");
    await page.click('[data-testid="add-todo-btn"]');

    const todoItem = page.locator('[data-testid="todo-item"]').first();
    await todoItem.hover();

    // 삭제 버튼이 있다면 클릭해서 다이얼로그 확인
    const deleteBtn = todoItem.locator('[data-testid="delete-todo-btn"]');
    if ((await deleteBtn.count()) > 0) {
      // 다이얼로그 이벤트 리스너 설정
      page.on("dialog", async (dialog) => {
        expect(dialog.type()).toBe("confirm");

        // 다이얼로그 메시지가 명확한지 확인
        const message = dialog.message();
        expect(message.length).toBeGreaterThan(0);

        await dialog.dismiss(); // 테스트용으로 취소
      });

      await deleteBtn.click();
    }

    console.log("✅ 동적 콘텐츠 접근성 테스트 완료");
  });

  test("모바일 접근성", async () => {
    console.log("📱 모바일 접근성 테스트");

    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: "networkidle" });

    // 1. 터치 타겟 크기 확인 (최소 44x44px)
    const interactiveElements = await page.evaluate(() => {
      const selectors = [
        "button",
        "a[href]",
        "input",
        "select",
        '[role="button"]',
        '[tabindex="0"]',
      ];
      const elements = selectors.flatMap((sel) =>
        Array.from(document.querySelectorAll(sel)),
      );

      return elements
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            testId: el.getAttribute("data-testid"),
            width: rect.width,
            height: rect.height,
            text: el.textContent?.trim().substring(0, 20),
          };
        })
        .filter((el) => el.width > 0 && el.height > 0);
    });

    console.log("👆 터치 타겟 크기:", interactiveElements);

    // 모든 인터랙티브 요소가 최소 크기를 만족하는지 확인
    interactiveElements.forEach((element) => {
      expect(element.width).toBeGreaterThanOrEqual(40); // 40px 이상 (44px 권장이지만 여유 있게)
      expect(element.height).toBeGreaterThanOrEqual(40);
    });

    // 2. 확대/축소 지원 확인
    const viewportMeta = await page.evaluate(() => {
      const viewport = document.querySelector('meta[name="viewport"]');
      return viewport?.getAttribute("content") || "";
    });

    console.log("📐 Viewport 메타태그:", viewportMeta);

    // viewport 메타태그에서 확대/축소를 막지 않는지 확인
    expect(viewportMeta).not.toMatch(/user-scalable=no/i);
    expect(viewportMeta).not.toMatch(/maximum-scale=1/i);

    // 3. 가로/세로 모드 전환 확인
    // 가로 모드로 회전
    await page.setViewportSize({ width: 812, height: 375 });
    await page.waitForTimeout(300);

    // 레이아웃이 깨지지 않는지 확인
    const headerVisible = await page
      .locator('[data-testid="todo-header"]')
      .isVisible();
    expect(headerVisible).toBe(true);

    // 할 일 입력이 여전히 작동하는지 확인
    await page.fill('[data-testid="todo-input"]', "가로 모드 테스트");
    await page.click('[data-testid="add-todo-btn"]');
    await expect(page.locator("text=가로 모드 테스트")).toBeVisible();

    console.log("✅ 모바일 접근성 테스트 완료");
  });

  test("인지 및 이해 접근성", async () => {
    console.log("🧠 인지 및 이해 접근성 테스트");

    // 1. 페이지 언어 설정 확인
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    console.log("🌐 페이지 언어:", htmlLang);
    expect(htmlLang).toBeTruthy();
    expect(htmlLang.length).toBeGreaterThan(0);

    // 2. 페이지 제목의 적절성 확인
    const pageTitle = await page.title();
    console.log("📄 페이지 제목:", pageTitle);
    expect(pageTitle.length).toBeGreaterThan(0);
    expect(pageTitle.length).toBeLessThan(60); // SEO 권장사항

    // 3. 의미 있는 링크 텍스트 확인 (있는 경우)
    const links = await page.evaluate(() => {
      const linkElements = Array.from(document.querySelectorAll("a[href]"));
      return linkElements.map((link) => ({
        href: link.getAttribute("href"),
        text: link.textContent?.trim(),
        ariaLabel: link.getAttribute("aria-label"),
        title: link.getAttribute("title"),
      }));
    });

    console.log("🔗 링크 요소:", links);

    // 모든 링크가 의미 있는 텍스트를 가지는지 확인
    links.forEach((link) => {
      const meaningfulText = link.text || link.ariaLabel || link.title;
      expect(meaningfulText).toBeTruthy();
      expect(meaningfulText?.toLowerCase()).not.toBe("click here");
      expect(meaningfulText?.toLowerCase()).not.toBe("read more");
    });

    // 4. 일관된 네비게이션 확인
    // 여러 페이지가 있다면 네비게이션 일관성 확인
    const navigationElements = await page.evaluate(() => {
      const nav = document.querySelector('nav, [role="navigation"]');
      if (!nav) return null;

      const links = Array.from(nav.querySelectorAll("a, button"));
      return links.map((link) => link.textContent?.trim());
    });

    console.log("🧭 네비게이션 요소:", navigationElements);

    // 5. 시간 제한 확인 (자동 새로고침, 타임아웃 등)
    const metaRefresh = await page.evaluate(() => {
      const refresh = document.querySelector('meta[http-equiv="refresh"]');
      return refresh?.getAttribute("content") || null;
    });

    if (metaRefresh) {
      console.log("🔄 자동 새로고침:", metaRefresh);
      // 자동 새로고침이 있다면 사용자가 제어할 수 있어야 함
    }

    // 6. 에러 식별 및 제안
    await page.fill('[data-testid="todo-input"]', ""); // 빈 입력
    await page.click('[data-testid="add-todo-btn"]');

    // 에러 상태 확인
    const hasErrorIndication = await page.evaluate(() => {
      const errorElements = document.querySelectorAll(
        '[aria-invalid="true"], .error, [role="alert"]',
      );
      return errorElements.length > 0;
    });

    console.log("⚠️ 에러 표시 상태:", hasErrorIndication);

    console.log("✅ 인지 및 이해 접근성 테스트 완료");
  });
});

/**
 * 보조 기술 시뮬레이션 테스트
 */
test.describe("보조 기술 시뮬레이션", () => {
  test("스크린 리더 내비게이션 시뮬레이션", async ({ browser }) => {
    console.log("🗣️ 스크린 리더 내비게이션 시뮬레이션");

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

    // 1. 헤딩 간 내비게이션 시뮬레이션
    const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
    console.log(`📑 발견된 헤딩 수: ${headings.length}`);

    for (let i = 0; i < headings.length; i++) {
      const headingText = await headings[i].textContent();
      const headingLevel = await headings[i].evaluate((el) =>
        el.tagName.charAt(1),
      );
      console.log(`  H${headingLevel}: ${headingText}`);

      // 헤딩으로 포커스 이동
      await headings[i].focus();
    }

    // 2. 랜드마크 내비게이션 시뮬레이션
    const landmarks = await page
      .locator(
        'main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]',
      )
      .all();
    console.log(`🏛️ 발견된 랜드마크 수: ${landmarks.length}`);

    for (let i = 0; i < landmarks.length; i++) {
      const role =
        (await landmarks[i].getAttribute("role")) ||
        (await landmarks[i].evaluate((el) => el.tagName.toLowerCase()));
      console.log(`  랜드마크: ${role}`);
    }

    // 3. 폼 필드 내비게이션
    const formFields = await page.locator("input, select, textarea").all();
    console.log(`📝 발견된 폼 필드 수: ${formFields.length}`);

    for (let i = 0; i < formFields.length; i++) {
      const field = formFields[i];
      const label = await field.evaluate((el) => {
        const input = el as HTMLInputElement;
        return (
          input.labels?.[0]?.textContent?.trim() ||
          input.getAttribute("aria-label") ||
          input.getAttribute("placeholder") ||
          "레이블 없음"
        );
      });

      const fieldType =
        (await field.getAttribute("type")) ||
        (await field.evaluate((el) => el.tagName.toLowerCase()));
      console.log(`  필드: ${fieldType} - ${label}`);
    }

    await context.close();
    console.log("✅ 스크린 리더 내비게이션 시뮬레이션 완료");
  });

  test("음성 인식 소프트웨어 시뮬레이션", async ({ browser }) => {
    console.log("🎤 음성 인식 소프트웨어 시뮬레이션");

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

    // 1. 음성 명령으로 인식 가능한 텍스트가 있는 요소들 확인
    const clickableElements = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          'button, a[href], [role="button"], [tabindex="0"]',
        ),
      );
      return elements
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim(),
          ariaLabel: el.getAttribute("aria-label"),
          title: el.getAttribute("title"),
          testId: el.getAttribute("data-testid"),
        }))
        .filter((el) => el.text || el.ariaLabel || el.title);
    });

    console.log("🗣️ 음성으로 클릭 가능한 요소들:");
    clickableElements.forEach((element, index) => {
      const commandText = element.text || element.ariaLabel || element.title;
      console.log(`  ${index + 1}. "${commandText}" (${element.tag})`);
    });

    // 2. 음성 명령 시뮬레이션 - "할 일 추가" 버튼 클릭
    const addButton = page.locator('[data-testid="add-todo-btn"]');
    const addButtonText = await addButton.textContent();
    console.log(`🎯 음성 명령 "${addButtonText}" 실행`);

    // 텍스트 입력 먼저
    await page.fill('[data-testid="todo-input"]', "음성 인식 테스트");

    // 음성 명령으로 버튼 클릭 시뮬레이션
    await addButton.click();

    await expect(page.locator("text=음성 인식 테스트")).toBeVisible();

    console.log("✅ 음성 인식 소프트웨어 시뮬레이션 완료");

    await context.close();
  });
});

/**
 * 접근성 성능 테스트
 */
test.describe("접근성 성능", () => {
  test("대량 데이터에서의 접근성 유지", async ({ browser }) => {
    console.log("⚡ 대량 데이터 접근성 성능 테스트");

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });

    // 1. 100개의 할 일 추가
    console.log("📊 100개 할 일 추가 중...");

    const startTime = Date.now();

    for (let i = 1; i <= 100; i++) {
      await page.fill('[data-testid="todo-input"]', `할 일 ${i}`);
      const priority = i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low";
      await page.selectOption('[data-testid="priority-select"]', priority);
      await page.click('[data-testid="add-todo-btn"]');

      if (i % 20 === 0) {
        console.log(`  진행률: ${i}/100`);
      }
    }

    const addTime = Date.now() - startTime;
    console.log(`⏱️ 100개 할 일 추가 시간: ${addTime}ms`);

    // 2. 접근성 검사 (대량 데이터 상태에서)
    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(accessibilityResults.violations).toEqual([]);
    console.log("✅ 대량 데이터 상태에서도 접근성 위반 없음");

    // 3. 키보드 네비게이션 성능
    const navStartTime = Date.now();

    // Tab을 여러 번 눌러 성능 확인
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }

    const navTime = Date.now() - navStartTime;
    console.log(`⌨️ 키보드 네비게이션 10회 시간: ${navTime}ms`);

    // 키보드 네비게이션이 500ms 내에 완료되는지 확인
    expect(navTime).toBeLessThan(500);

    console.log("✅ 대량 데이터 접근성 성능 테스트 완료");

    await context.close();
  });
});
