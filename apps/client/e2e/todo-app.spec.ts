import { test, expect } from '@playwright/test';
import { TodoPage } from './page-objects/todo-page';

test.describe('TODO 앱 핵심 기능 테스트', () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage();
  });

  test.describe('애플리케이션 로드 및 초기 상태', () => {
    test('애플리케이션이 성공적으로 로드되어야 함', async ({ page }) => {
      // 헤더 확인
      await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
      await expect(page.locator('text=TaskFlow')).toBeVisible();
      
      // 대시보드 통계 확인
      await expect(page.locator('[data-testid="todo-dashboard"]')).toBeVisible();
      await expect(page.locator('text=전체 할 일')).toBeVisible();
      
      // 빈 상태 메시지 확인
      await expect(page.locator('text=할 일이 없습니다')).toBeVisible();
    });

    test('초기 통계가 올바르게 표시되어야 함', async () => {
      await todoPage.expectStatsToEqual({
        total: 0,
        active: 0,
        completed: 0,
        completionRate: 0
      });
    });
  });

  test.describe('할 일 생성 기능', () => {
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

      // 우선순위별 배지 확인
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

  test.describe('할 일 조작 기능', () => {
    test.beforeEach(async () => {
      // 테스트용 할 일들 생성
      await todoPage.addTodo('완료할 할 일', 'high');
      await todoPage.addTodo('수정할 할 일', 'medium');
      await todoPage.addTodo('삭제할 할 일', 'low');
    });

    test('할 일을 완료로 표시할 수 있어야 함', async () => {
      await todoPage.toggleTodo('완료할 할 일');
      
      // 완료 상태 확인
      await expect(todoPage.getTodoCheckbox('완료할 할 일')).toBeChecked();
      
      // 완료된 할 일 스타일 확인
      await expect(todoPage.getTodoTitle('완료할 할 일')).toHaveClass(/line-through/);
      
      // 통계 업데이트 확인
      await todoPage.expectStatsToEqual({
        total: 3,
        active: 2,
        completed: 1,
        completionRate: 33
      });
    });

    test('할 일을 수정할 수 있어야 함', async () => {
      const newTitle = '수정된 할 일 제목';
      
      await todoPage.editTodo('수정할 할 일', newTitle);
      
      // 수정된 제목 확인
      await expect(todoPage.getTodoItem(newTitle)).toBeVisible();
      await expect(todoPage.getTodoItem('수정할 할 일')).not.toBeVisible();
    });

    test('할 일을 삭제할 수 있어야 함', async () => {
      await todoPage.deleteTodo('삭제할 할 일');
      
      // 삭제된 할 일이 보이지 않는지 확인
      await expect(todoPage.getTodoItem('삭제할 할 일')).not.toBeVisible();
      
      // 통계 업데이트 확인
      await todoPage.expectStatsToEqual({
        total: 2,
        active: 2,
        completed: 0,
        completionRate: 0
      });
    });
  });

  test.describe('필터링 및 정렬 기능', () => {
    test.beforeEach(async () => {
      // 다양한 상태의 할 일들 생성
      await todoPage.addTodo('완료된 할 일 1', 'high');
      await todoPage.addTodo('진행중인 할 일 1', 'medium');
      await todoPage.addTodo('완료된 할 일 2', 'low');
      
      // 일부 완료 처리
      await todoPage.toggleTodo('완료된 할 일 1');
      await todoPage.toggleTodo('완료된 할 일 2');
    });

    test('진행중 필터가 올바르게 작동해야 함', async () => {
      await todoPage.applyFilter('active');
      
      // 진행중인 할 일만 표시되는지 확인
      await expect(todoPage.getTodoItem('진행중인 할 일 1')).toBeVisible();
      await expect(todoPage.getTodoItem('완료된 할 일 1')).not.toBeVisible();
      await expect(todoPage.getTodoItem('완료된 할 일 2')).not.toBeVisible();
    });

    test('완료됨 필터가 올바르게 작동해야 함', async () => {
      await todoPage.applyFilter('completed');
      
      // 완료된 할 일들만 표시되는지 확인
      await expect(todoPage.getTodoItem('완료된 할 일 1')).toBeVisible();
      await expect(todoPage.getTodoItem('완료된 할 일 2')).toBeVisible();
      await expect(todoPage.getTodoItem('진행중인 할 일 1')).not.toBeVisible();
    });

    test('우선순위별 정렬이 올바르게 작동해야 함', async () => {
      await todoPage.sortBy('priority', 'desc');
      
      // 우선순위 순서로 정렬되었는지 확인
      const todoItems = await todoPage.getAllTodoTitles();
      expect(todoItems[0]).toContain('완료된 할 일 1'); // high
      expect(todoItems[1]).toContain('진행중인 할 일 1'); // medium
      expect(todoItems[2]).toContain('완료된 할 일 2'); // low
    });
  });

  test.describe('검색 기능', () => {
    test.beforeEach(async () => {
      await todoPage.addTodo('리액트 공부하기', 'high');
      await todoPage.addTodo('자바스크립트 복습', 'medium');
      await todoPage.addTodo('타입스크립트 학습', 'low');
    });

    test('검색어로 할 일을 필터링할 수 있어야 함', async () => {
      await todoPage.search('리액트');
      
      // 검색 결과 확인
      await expect(todoPage.getTodoItem('리액트 공부하기')).toBeVisible();
      await expect(todoPage.getTodoItem('자바스크립트 복습')).not.toBeVisible();
      await expect(todoPage.getTodoItem('타입스크립트 학습')).not.toBeVisible();
    });

    test('검색 결과가 없을 때 적절한 메시지를 표시해야 함', async () => {
      await todoPage.search('파이썬');
      
      await expect(todoPage.page.locator('text=검색 결과가 없습니다')).toBeVisible();
    });
  });

  test.describe('반응형 디자인', () => {
    test('모바일 뷰포트에서 올바르게 작동해야 함', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // 모바일 헤더 확인
      await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
      
      // 필터 패널이 토글되는지 확인
      const filterToggle = page.locator('[data-testid="filter-toggle"]');
      if (await filterToggle.isVisible()) {
        await filterToggle.click();
        await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible();
      }
    });

    test('태블릿 뷰포트에서 올바르게 작동해야 함', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await todoPage.addTodo('태블릿 테스트', 'medium');
      await expect(todoPage.getTodoItem('태블릿 테스트')).toBeVisible();
    });
  });

  test.describe('데이터 지속성', () => {
    test('페이지 새로고침 후에도 데이터가 유지되어야 함', async ({ page }) => {
      await todoPage.addTodo('지속성 테스트', 'high');
      await todoPage.toggleTodo('지속성 테스트');
      
      // 페이지 새로고침
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // 데이터가 유지되는지 확인
      await expect(todoPage.getTodoItem('지속성 테스트')).toBeVisible();
      await expect(todoPage.getTodoCheckbox('지속성 테스트')).toBeChecked();
    });
  });
});