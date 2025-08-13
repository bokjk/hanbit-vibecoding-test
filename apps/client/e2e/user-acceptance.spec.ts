import { test, expect, Page } from "@playwright/test";

/**
 * 사용자 수용 테스트 (UAT) 스위트
 * 실제 사용자 워크플로우와 사용자 경험을 검증하는 테스트
 */

test.describe("사용자 수용 테스트 (UAT) - 핵심 시나리오", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // 로컬스토리지 클리어
    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("시나리오 1: 신규 사용자의 첫 방문 경험", async () => {
    console.log("🎯 시나리오 1: 신규 사용자의 첫 방문 경험");

    // 1. 애플리케이션 첫 로딩
    await page.goto("http://localhost:4173");

    // 2. 초기 화면 구성 요소 확인
    await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
    await expect(page.locator("text=TaskFlow")).toBeVisible();

    // 3. 대시보드 통계 확인 (초기 상태)
    await expect(page.locator('[data-testid="todo-dashboard"]')).toBeVisible();
    await expect(page.locator("text=대시보드 개요")).toBeVisible();

    // 4. 빈 상태 메시지 확인
    await expect(page.locator('h3:has-text("할 일이 없습니다")')).toBeVisible();

    // 5. 초기 통계가 모두 0인지 확인
    const statsLocator = page.locator('[data-testid="stats-card"]');
    const statsCards = await statsLocator.all();

    for (const card of statsCards) {
      const value = await card.locator(".text-2xl, .text-xl").textContent();
      if (value && value.includes("%")) {
        expect(value).toContain("0%");
      } else if (value) {
        expect(value).toBe("0");
      }
    }

    console.log("✅ 신규 사용자 첫 방문 경험 검증 완료");
  });

  test("시나리오 2: 일상적인 할 일 관리 워크플로우", async () => {
    console.log("🎯 시나리오 2: 일상적인 할 일 관리 워크플로우");

    await page.goto("http://localhost:4173");

    // 1. 아침에 할 일 추가
    const morningTasks = [
      { title: "이메일 확인하기", priority: "high" },
      { title: "팀 미팅 준비", priority: "high" },
      { title: "프로젝트 계획 검토", priority: "medium" },
    ];

    for (const task of morningTasks) {
      await page.fill('[data-testid="todo-input"]', task.title);
      await page.selectOption('[data-testid="priority-select"]', task.priority);
      await page.click('[data-testid="add-todo-btn"]');

      // 추가된 할 일이 목록에 나타나는지 확인
      await expect(page.locator(`text=${task.title}`)).toBeVisible();
    }

    // 2. 통계 업데이트 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("3");
    await expect(
      page.locator('[data-testid="stats-active"] .text-2xl'),
    ).toHaveText("3");
    await expect(
      page.locator('[data-testid="stats-completed"] .text-2xl'),
    ).toHaveText("0");

    // 3. 우선순위별 필터링 테스트
    await page.click('[data-testid="filter-high"]');
    await expect(page.locator(`text=이메일 확인하기`)).toBeVisible();
    await expect(page.locator(`text=팀 미팅 준비`)).toBeVisible();
    await expect(page.locator(`text=프로젝트 계획 검토`)).not.toBeVisible();

    // 4. 모든 할 일 다시 보기
    await page.click('[data-testid="filter-all"]');

    // 5. 첫 번째 할 일 완료 처리
    const firstTodoCheckbox = page.locator(
      '[data-testid="todo-item"]:first-child input[type="checkbox"]',
    );
    await firstTodoCheckbox.click();

    // 6. 완료 통계 업데이트 확인
    await expect(
      page.locator('[data-testid="stats-completed"] .text-2xl'),
    ).toHaveText("1");
    await expect(
      page.locator('[data-testid="stats-active"] .text-2xl'),
    ).toHaveText("2");

    // 7. 완료율 계산 확인 (1/3 = 33%)
    const completionRate = await page
      .locator('[data-testid="stats-completion"] .text-2xl')
      .textContent();
    expect(completionRate).toBe("33%");

    console.log("✅ 일상적인 할 일 관리 워크플로우 검증 완료");
  });

  test("시나리오 3: 할 일 편집 및 우선순위 변경", async () => {
    console.log("🎯 시나리오 3: 할 일 편집 및 우선순위 변경");

    await page.goto("http://localhost:4173");

    // 1. 초기 할 일 추가
    await page.fill('[data-testid="todo-input"]', "중요한 회의 준비");
    await page.selectOption('[data-testid="priority-select"]', "medium");
    await page.click('[data-testid="add-todo-btn"]');

    // 2. 추가된 할 일 확인
    await expect(page.locator("text=중요한 회의 준비")).toBeVisible();

    // 3. 할 일 편집 시작
    const todoItem = page.locator('[data-testid="todo-item"]').first();
    await todoItem.hover();
    await todoItem.locator('[data-testid="edit-todo-btn"]').click();

    // 4. 제목 수정
    const editInput = todoItem.locator('[data-testid="edit-todo-input"]');
    await editInput.clear();
    await editInput.fill("긴급한 CEO 회의 준비");

    // 5. 우선순위 변경 (medium → high)
    await todoItem
      .locator('[data-testid="edit-priority-select"]')
      .selectOption("high");

    // 6. 변경사항 저장
    await todoItem.locator('[data-testid="save-todo-btn"]').click();

    // 7. 변경사항 확인
    await expect(page.locator("text=긴급한 CEO 회의 준비")).toBeVisible();
    await expect(page.locator("text=중요한 회의 준비")).not.toBeVisible();

    // 8. 높은 우선순위로 변경되었는지 확인
    await expect(
      page.locator('[data-testid="priority-badge"]:has-text("긴급")'),
    ).toBeVisible();

    console.log("✅ 할 일 편집 및 우선순위 변경 검증 완료");
  });

  test("시나리오 4: 검색 및 필터링 활용", async () => {
    console.log("🎯 시나리오 4: 검색 및 필터링 활용");

    await page.goto("http://localhost:4173");

    // 1. 다양한 할 일 추가
    const tasks = [
      { title: "회의실 예약하기", priority: "high" },
      { title: "보고서 작성", priority: "medium" },
      { title: "회의 자료 준비", priority: "high" },
      { title: "이메일 답장", priority: "low" },
      { title: "회의록 정리", priority: "medium" },
    ];

    for (const task of tasks) {
      await page.fill('[data-testid="todo-input"]', task.title);
      await page.selectOption('[data-testid="priority-select"]', task.priority);
      await page.click('[data-testid="add-todo-btn"]');
    }

    // 2. 모든 할 일이 추가되었는지 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("5");

    // 3. "회의" 키워드로 검색
    await page.fill('[data-testid="search-input"]', "회의");

    // 4. 검색 결과 확인
    await expect(page.locator("text=회의실 예약하기")).toBeVisible();
    await expect(page.locator("text=회의 자료 준비")).toBeVisible();
    await expect(page.locator("text=회의록 정리")).toBeVisible();
    await expect(page.locator("text=보고서 작성")).not.toBeVisible();
    await expect(page.locator("text=이메일 답장")).not.toBeVisible();

    // 5. 검색 결과에서 우선순위 필터링
    await page.click('[data-testid="filter-high"]');
    await expect(page.locator("text=회의실 예약하기")).toBeVisible();
    await expect(page.locator("text=회의 자료 준비")).toBeVisible();
    await expect(page.locator("text=회의록 정리")).not.toBeVisible(); // medium 우선순위

    // 6. 검색어 클리어
    await page.fill('[data-testid="search-input"]', "");

    // 7. 모든 할 일이 다시 표시되는지 확인
    await page.click('[data-testid="filter-all"]');
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("5");

    console.log("✅ 검색 및 필터링 활용 검증 완료");
  });

  test("시나리오 5: 대량 작업 및 성능", async () => {
    console.log("🎯 시나리오 5: 대량 작업 및 성능");

    await page.goto("http://localhost:4173");

    const startTime = Date.now();

    // 1. 대량 할 일 추가 (20개)
    for (let i = 1; i <= 20; i++) {
      await page.fill('[data-testid="todo-input"]', `할 일 ${i}`);
      const priority = i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low";
      await page.selectOption('[data-testid="priority-select"]', priority);
      await page.click('[data-testid="add-todo-btn"]');

      // 매 5번째마다 진행상황 확인
      if (i % 5 === 0) {
        await expect(
          page.locator('[data-testid="stats-total"] .text-2xl'),
        ).toHaveText(i.toString());
      }
    }

    // 2. 최종 개수 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("20");

    // 3. 일부 할 일 완료 처리 (10개)
    for (let i = 0; i < 10; i++) {
      const checkbox = page.locator(
        `[data-testid="todo-item"]:nth-child(${i + 1}) input[type="checkbox"]`,
      );
      await checkbox.click();
    }

    // 4. 완료 통계 확인
    await expect(
      page.locator('[data-testid="stats-completed"] .text-2xl'),
    ).toHaveText("10");
    await expect(
      page.locator('[data-testid="stats-active"] .text-2xl'),
    ).toHaveText("10");
    await expect(
      page.locator('[data-testid="stats-completion"] .text-2xl'),
    ).toHaveText("50%");

    // 5. 성능 측정
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`⏱️ 대량 작업 완료 시간: ${totalTime}ms`);

    // 6. 성능 기준 확인 (20초 이내 완료)
    expect(totalTime).toBeLessThan(20000);

    // 7. 애플리케이션이 여전히 반응하는지 확인
    await page.fill('[data-testid="search-input"]', "할 일 1");
    await expect(page.locator("text=할 일 1")).toBeVisible();

    console.log("✅ 대량 작업 및 성능 검증 완료");
  });

  test("시나리오 6: 브라우저 새로고침 후 데이터 지속성", async () => {
    console.log("🎯 시나리오 6: 브라우저 새로고침 후 데이터 지속성");

    await page.goto("http://localhost:4173");

    // 1. 할 일 추가
    const testTasks = [
      { title: "중요한 업무", priority: "high" },
      { title: "일반 업무", priority: "medium" },
    ];

    for (const task of testTasks) {
      await page.fill('[data-testid="todo-input"]', task.title);
      await page.selectOption('[data-testid="priority-select"]', task.priority);
      await page.click('[data-testid="add-todo-btn"]');
    }

    // 2. 첫 번째 할 일 완료 처리
    await page
      .locator('[data-testid="todo-item"]:first-child input[type="checkbox"]')
      .click();

    // 3. 상태 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("2");
    await expect(
      page.locator('[data-testid="stats-completed"] .text-2xl'),
    ).toHaveText("1");

    // 4. 페이지 새로고침
    await page.reload({ waitUntil: "networkidle" });

    // 5. 데이터가 유지되는지 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("2");
    await expect(
      page.locator('[data-testid="stats-completed"] .text-2xl'),
    ).toHaveText("1");
    await expect(
      page.locator('[data-testid="stats-active"] .text-2xl'),
    ).toHaveText("1");

    // 6. 할 일 제목과 상태 확인
    await expect(page.locator("text=중요한 업무")).toBeVisible();
    await expect(page.locator("text=일반 업무")).toBeVisible();

    // 7. 완료된 할 일의 체크박스 상태 확인
    const firstCheckbox = page.locator(
      '[data-testid="todo-item"]:first-child input[type="checkbox"]',
    );
    await expect(firstCheckbox).toBeChecked();

    console.log("✅ 브라우저 새로고침 후 데이터 지속성 검증 완료");
  });

  test("시나리오 7: 에러 처리 및 사용자 피드백", async () => {
    console.log("🎯 시나리오 7: 에러 처리 및 사용자 피드백");

    await page.goto("http://localhost:4173");

    // 1. 빈 제목으로 할 일 추가 시도
    await page.click('[data-testid="add-todo-btn"]');

    // 2. 에러 메시지나 피드백 확인 (할 일이 추가되지 않았는지 확인)
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("0");

    // 3. 매우 긴 제목으로 할 일 추가 시도
    const longTitle = "이것은 매우 긴 할 일 제목입니다. ".repeat(10); // 약 300자
    await page.fill('[data-testid="todo-input"]', longTitle);
    await page.click('[data-testid="add-todo-btn"]');

    // 4. 긴 제목도 정상적으로 처리되는지 확인
    await expect(
      page.locator('[data-testid="stats-total"] .text-2xl'),
    ).toHaveText("1");

    // 5. 존재하지 않는 할 일 편집 시도 (UI가 일관성 있게 동작하는지)
    const todoItem = page.locator('[data-testid="todo-item"]').first();
    await todoItem.hover();

    // 6. 편집 모드에서 ESC 키로 취소
    await todoItem.locator('[data-testid="edit-todo-btn"]').click();
    await page.keyboard.press("Escape");

    // 7. 원래 상태로 돌아갔는지 확인
    await expect(
      todoItem.locator('[data-testid="edit-todo-input"]'),
    ).not.toBeVisible();

    console.log("✅ 에러 처리 및 사용자 피드백 검증 완료");
  });
});

test.describe("사용자 경험 (UX) 검증", () => {
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

  test("로딩 상태 및 사용자 피드백", async () => {
    console.log("🎯 UX: 로딩 상태 및 사용자 피드백");

    // 1. 페이지 로딩 시간 측정
    const startTime = Date.now();
    await page.goto("http://localhost:4173", { waitUntil: "networkidle" });
    const loadTime = Date.now() - startTime;

    console.log(`⏱️ 페이지 로딩 시간: ${loadTime}ms`);

    // 2. 로딩 시간이 3초 이내인지 확인
    expect(loadTime).toBeLessThan(3000);

    // 3. 인터랙션 반응성 테스트
    const actionStartTime = Date.now();
    await page.fill('[data-testid="todo-input"]', "반응성 테스트");
    await page.click('[data-testid="add-todo-btn"]');
    await expect(page.locator("text=반응성 테스트")).toBeVisible();
    const actionTime = Date.now() - actionStartTime;

    console.log(`⚡ 인터랙션 반응 시간: ${actionTime}ms`);

    // 4. 인터랙션 반응 시간이 500ms 이내인지 확인
    expect(actionTime).toBeLessThan(500);
  });

  test("키보드 접근성 및 네비게이션", async () => {
    console.log("🎯 UX: 키보드 접근성 및 네비게이션");

    // 1. Tab 키로 네비게이션 테스트
    await page.keyboard.press("Tab"); // 첫 번째 포커스 가능한 요소로

    // 2. Enter 키로 할 일 추가
    await page.keyboard.type("키보드로 추가된 할 일");
    await page.keyboard.press("Tab"); // 우선순위 선택으로
    await page.keyboard.press("Tab"); // 추가 버튼으로
    await page.keyboard.press("Enter"); // 추가 실행

    // 3. 할 일이 추가되었는지 확인
    await expect(page.locator("text=키보드로 추가된 할 일")).toBeVisible();

    // 4. Arrow 키로 할 일 네비게이션
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space"); // 체크박스 토글

    // 5. 완료 상태가 변경되었는지 확인
    await expect(
      page.locator('[data-testid="stats-completed"] .text-2xl'),
    ).toHaveText("1");
  });

  test("시각적 피드백 및 애니메이션", async () => {
    console.log("🎯 UX: 시각적 피드백 및 애니메이션");

    // 1. 할 일 추가
    await page.fill('[data-testid="todo-input"]', "애니메이션 테스트");
    await page.click('[data-testid="add-todo-btn"]');

    // 2. 할 일이 부드럽게 나타나는지 확인
    const todoItem = page.locator('[data-testid="todo-item"]').first();
    await expect(todoItem).toBeVisible();

    // 3. 호버 효과 테스트
    await todoItem.hover();

    // 4. 편집 버튼이 나타나는지 확인
    await expect(
      todoItem.locator('[data-testid="edit-todo-btn"]'),
    ).toBeVisible();

    // 5. 완료 체크 시 시각적 변화
    const checkbox = todoItem.locator('input[type="checkbox"]');
    await checkbox.click();

    // 6. 체크된 상태의 시각적 스타일 확인
    await expect(checkbox).toBeChecked();
  });
});
