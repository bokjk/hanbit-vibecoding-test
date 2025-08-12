import { test, expect } from "@playwright/test";
import { TodoPage } from "./page-objects/todo-page";

test.describe("TODO 앱 핵심 기능 테스트", () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage();
  });

  test("애플리케이션이 성공적으로 로드되어야 함", async ({ page }) => {
    // 헤더 확인
    await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
    await expect(page.locator("text=TaskFlow")).toBeVisible();

    // 대시보드 통계 확인
    await expect(page.locator('[data-testid="todo-dashboard"]')).toBeVisible();
    await expect(page.locator("text=대시보드 개요")).toBeVisible();

    // 빈 상태 메시지 확인 (더 구체적인 선택자 사용)
    await expect(page.locator('h3:has-text("할 일이 없습니다")')).toBeVisible();
  });

  test("초기 통계가 올바르게 표시되어야 함", async () => {
    await todoPage.expectStatsToEqual({
      total: 0,
      active: 0,
      completed: 0,
      completionRate: 0,
    });
  });

  test("새로운 할 일을 추가할 수 있어야 함", async () => {
    const todoTitle = "첫 번째 할 일";

    await todoPage.addTodo(todoTitle, "medium");

    // 할 일이 목록에 표시되는지 확인
    await expect(todoPage.getTodoItem(todoTitle)).toBeVisible();

    // 통계 업데이트 확인
    await todoPage.expectStatsToEqual({
      total: 1,
      active: 1,
      completed: 0,
      completionRate: 0,
    });
  });

  test("다양한 우선순위로 할 일을 추가할 수 있어야 함", async () => {
    await todoPage.addTodo("긴급한 할 일", "high");
    await todoPage.addTodo("일반적인 할 일", "medium");
    await todoPage.addTodo("나중에 할 일", "low");

    // 우선순위별 배지 확인 (실제 앱에서 사용하는 텍스트로 수정)
    await expect(todoPage.page.locator("text=긴급")).toBeVisible();
    await expect(todoPage.page.locator("text=보통")).toBeVisible();
    await expect(todoPage.page.locator("text=낮음")).toBeVisible();
  });

  test("빈 제목으로는 할 일을 추가할 수 없어야 함", async () => {
    await todoPage.addTodo("", "medium");

    // 할 일이 추가되지 않았는지 확인
    await todoPage.expectStatsToEqual({
      total: 0,
      active: 0,
      completed: 0,
      completionRate: 0,
    });
  });

  test("할 일을 완료로 표시할 수 있어야 함", async () => {
    const todoTitle = "완료할 할 일";

    // 할 일 추가
    await todoPage.addTodo(todoTitle, "medium");

    // 초기 상태 확인
    await todoPage.expectStatsToEqual({
      total: 1,
      active: 1,
      completed: 0,
      completionRate: 0,
    });

    // 할 일 완료 표시
    await todoPage.toggleTodo(todoTitle);

    // 완료 상태 확인
    await todoPage.expectStatsToEqual({
      total: 1,
      active: 0,
      completed: 1,
      completionRate: 100,
    });
  });

  test("할 일을 편집할 수 있어야 함", async () => {
    const originalTitle = "원래 제목";
    const newTitle = "수정된 제목";

    // 할 일 추가
    await todoPage.addTodo(originalTitle, "high");

    // 원래 제목이 표시되는지 확인
    await expect(todoPage.getTodoItem(originalTitle)).toBeVisible();

    // 할 일 편집
    await todoPage.editTodo(originalTitle, newTitle);

    // 새 제목이 표시되고 원래 제목은 사라졌는지 확인
    await expect(todoPage.getTodoItem(newTitle)).toBeVisible();
    await expect(todoPage.getTodoItem(originalTitle)).not.toBeVisible();
  });

  test("할 일을 삭제할 수 있어야 함", async () => {
    const todoTitle = "삭제할 할 일";

    // 할 일 추가
    await todoPage.addTodo(todoTitle, "low");

    // 추가되었는지 확인
    await todoPage.expectStatsToEqual({
      total: 1,
      active: 1,
      completed: 0,
      completionRate: 0,
    });

    // 할 일 삭제
    await todoPage.deleteTodo(todoTitle);

    // 삭제되었는지 확인
    await todoPage.expectStatsToEqual({
      total: 0,
      active: 0,
      completed: 0,
      completionRate: 0,
    });
  });
});

test.describe("TODO 앱 필터링 및 정렬 테스트", () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage();

    // 테스트용 할 일 여러 개 추가
    await todoPage.addTodo("첫 번째 할 일", "high");
    await todoPage.addTodo("두 번째 할 일", "medium");
    await todoPage.addTodo("세 번째 할 일", "low");

    // 첫 번째 할 일 완료 처리
    await todoPage.toggleTodo("첫 번째 할 일");
  });

  test("완료된 할 일만 필터링할 수 있어야 함", async () => {
    // 완료된 할 일만 보기
    await todoPage.applyFilter("completed");

    // 완료된 할 일만 표시되는지 확인
    await expect(todoPage.getTodoItem("첫 번째 할 일")).toBeVisible();
    await expect(todoPage.getTodoItem("두 번째 할 일")).not.toBeVisible();
    await expect(todoPage.getTodoItem("세 번째 할 일")).not.toBeVisible();
  });

  test("진행 중인 할 일만 필터링할 수 있어야 함", async () => {
    // 진행 중인 할 일만 보기
    await todoPage.applyFilter("active");

    // 진행 중인 할 일만 표시되는지 확인
    await expect(todoPage.getTodoItem("첫 번째 할 일")).not.toBeVisible();
    await expect(todoPage.getTodoItem("두 번째 할 일")).toBeVisible();
    await expect(todoPage.getTodoItem("세 번째 할 일")).toBeVisible();
  });

  test("모든 할 일을 볼 수 있어야 함", async () => {
    // 모든 할 일 보기
    await todoPage.applyFilter("all");

    // 모든 할 일이 표시되는지 확인
    await expect(todoPage.getTodoItem("첫 번째 할 일")).toBeVisible();
    await expect(todoPage.getTodoItem("두 번째 할 일")).toBeVisible();
    await expect(todoPage.getTodoItem("세 번째 할 일")).toBeVisible();
  });
});

test.describe("TODO 앱 검색 테스트", () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage();

    // 검색 테스트용 할 일들 추가
    await todoPage.addTodo("회의 준비하기", "high");
    await todoPage.addTodo("보고서 작성", "medium");
    await todoPage.addTodo("회의록 정리", "low");
    await todoPage.addTodo("프로젝트 계획", "medium");
  });

  test("할 일을 검색할 수 있어야 함", async () => {
    // '회의' 검색
    await todoPage.search("회의");

    // 검색 결과 확인
    await expect(todoPage.getTodoItem("회의 준비하기")).toBeVisible();
    await expect(todoPage.getTodoItem("회의록 정리")).toBeVisible();
    await expect(todoPage.getTodoItem("보고서 작성")).not.toBeVisible();
    await expect(todoPage.getTodoItem("프로젝트 계획")).not.toBeVisible();
  });

  test("검색어를 지우면 모든 할 일이 표시되어야 함", async () => {
    // 검색 후
    await todoPage.search("보고서");
    await expect(todoPage.getTodoItem("보고서 작성")).toBeVisible();
    await expect(todoPage.getTodoItem("회의 준비하기")).not.toBeVisible();

    // 검색어 지우기
    await todoPage.search("");

    // 모든 할 일이 다시 표시되는지 확인
    await expect(todoPage.getTodoItem("회의 준비하기")).toBeVisible();
    await expect(todoPage.getTodoItem("보고서 작성")).toBeVisible();
    await expect(todoPage.getTodoItem("회의록 정리")).toBeVisible();
    await expect(todoPage.getTodoItem("프로젝트 계획")).toBeVisible();
  });
});
