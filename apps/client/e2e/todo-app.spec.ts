import { test, expect } from '@playwright/test';
import { TodoPage } from './page-objects/todo-page';

test.describe('TODO 앱 핵심 기능 테스트', () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage();
  });

  test('애플리케이션이 성공적으로 로드되어야 함', async ({ page }) => {
    // 헤더 확인
    await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
    await expect(page.locator('text=TaskFlow')).toBeVisible();
    
    // 대시보드 통계 확인
    await expect(page.locator('[data-testid="todo-dashboard"]')).toBeVisible();
    await expect(page.locator('text=대시보드 개요')).toBeVisible();
    
    // 빈 상태 메시지 확인 (더 구체적인 선택자 사용)
    await expect(page.locator('h3:has-text("할 일이 없습니다")')).toBeVisible();
  });

  test('초기 통계가 올바르게 표시되어야 함', async () => {
    await todoPage.expectStatsToEqual({
      total: 0,
      active: 0,
      completed: 0,
      completionRate: 0
    });
  });

  test('새로운 할 일을 추가할 수 있어야 함', async () => {
    const todoTitle = '첫 번째 할 일';
    
    await todoPage.addTodo(todoTitle, 'medium');
    
    // 할 일이 목록에 표시되는지 확인
    await expect(todoPage.getTodoItem(todoTitle)).toBeVisible();
    
    // 통계 업데이트 확인
    await todoPage.expectStatsToEqual({
      total: 1,
      active: 1,
      completed: 0,
      completionRate: 0
    });
  });

  test('다양한 우선순위로 할 일을 추가할 수 있어야 함', async () => {
    await todoPage.addTodo('긴급한 할 일', 'high');
    await todoPage.addTodo('일반적인 할 일', 'medium');
    await todoPage.addTodo('나중에 할 일', 'low');

    // 우선순위별 배지 확인 (실제 앱에서 사용하는 텍스트로 수정)
    await expect(todoPage.page.locator('text=긴급')).toBeVisible();
    await expect(todoPage.page.locator('text=보통')).toBeVisible();
    await expect(todoPage.page.locator('text=낮음')).toBeVisible();
  });

  test('빈 제목으로는 할 일을 추가할 수 없어야 함', async () => {
    await todoPage.addTodo('', 'medium');
    
    // 할 일이 추가되지 않았는지 확인
    await todoPage.expectStatsToEqual({
      total: 0,
      active: 0,
      completed: 0,
      completionRate: 0
    });
  });
});