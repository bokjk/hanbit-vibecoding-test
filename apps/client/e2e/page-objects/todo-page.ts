import { Page, Locator, expect } from '@playwright/test';

export type Priority = 'high' | 'medium' | 'low';
export type FilterType = 'all' | 'active' | 'completed';
export type SortBy = 'createdAt' | 'priority' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface TodoStats {
  total: number;
  active: number;
  completed: number;
  completionRate: number;
}

/**
 * TODO 앱 페이지 오브젝트
 * 사용자 인터랙션을 추상화하여 테스트 코드의 가독성과 유지보수성을 향상시킵니다.
 */
export class TodoPage {
  readonly page: Page;
  
  // 주요 페이지 요소들
  readonly header: Locator;
  readonly dashboard: Locator;
  readonly todoInput: Locator;
  readonly prioritySelect: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;
  readonly todoList: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // 페이지 요소 선택자 정의 (중복 요소 처리)
    this.header = page.locator('[data-testid="todo-header"]');
    this.dashboard = page.locator('[data-testid="todo-dashboard"]');
    this.todoInput = page.locator('[data-testid="todo-input"]').first(); // 첫 번째 요소 선택 (데스크톱)
    this.prioritySelect = page.locator('[data-testid="priority-select"]').first(); // 첫 번째 요소 선택
    this.addButton = page.locator('[data-testid="add-todo-button"]').first(); // 첫 번째 요소 선택
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.todoList = page.locator('[data-testid="todo-list"]');
  }

  /**
   * TODO 앱 페이지로 이동
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    
    // 핵심 요소들이 로드될 때까지 대기
    await expect(this.header).toBeVisible();
    await expect(this.dashboard).toBeVisible();
  }

  /**
   * 로컬스토리지 및 세션스토리지 클리어
   */
  async clearStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * 새로운 할 일 추가
   */
  async addTodo(title: string, priority: Priority = 'medium') {
    if (!title.trim()) {
      // 빈 제목인 경우 그냥 시도만 하고 리턴
      await this.todoInput.fill('');
      await this.addButton.click();
      return;
    }

    await this.todoInput.fill(title);
    
    // 우선순위 선택 (shadcn/ui Select 컴포넌트 구조에 맞게 수정)
    await this.prioritySelect.click();
    
    // SelectContent가 나타날 때까지 대기
    await this.page.waitForSelector('[role="listbox"]', { timeout: 5000 });
    
    // 우선순위 값에 따른 SelectItem 클릭
    const priorityText = priority === 'high' ? '높음' : priority === 'medium' ? '보통' : '낮음';
    await this.page.locator(`[role="option"]:has-text("${priorityText}")`).click();
    
    // 추가 버튼 클릭
    await this.addButton.click();
    
    // 할 일이 추가될 때까지 대기 (제목이 없으면 대기하지 않음)
    if (title.trim()) {
      await this.page.waitForTimeout(500); // 추가 완료 대기
    }
  }

  /**
   * 할 일 아이템 선택자 반환
   */
  getTodoItem(title: string): Locator {
    return this.page.locator(`[data-testid="todo-item"]:has-text("${title}")`);
  }

  /**
   * 할 일 제목 선택자 반환
   */
  getTodoTitle(title: string): Locator {
    return this.getTodoItem(title).locator('[data-testid="todo-title"]');
  }

  /**
   * 할 일 체크박스 선택자 반환
   */
  getTodoCheckbox(title: string): Locator {
    return this.getTodoItem(title).locator('[data-testid="todo-checkbox"]');
  }

  /**
   * 할 일 완료 상태 토글
   */
  async toggleTodo(title: string) {
    const checkbox = this.getTodoCheckbox(title);
    await checkbox.click();
    
    // 상태 변경이 반영될 때까지 잠시 대기
    await this.page.waitForTimeout(100);
  }

  /**
   * 할 일 수정
   */
  async editTodo(oldTitle: string, newTitle: string) {
    const todoItem = this.getTodoItem(oldTitle);
    const editButton = todoItem.locator('[data-testid="edit-button"]');
    
    await editButton.click();
    
    // 편집 모드 입력 필드
    const editInput = todoItem.locator('[data-testid="edit-input"]');
    await editInput.fill(newTitle);
    await editInput.press('Enter');
    
    // 수정이 완료될 때까지 대기
    await expect(this.getTodoItem(newTitle)).toBeVisible({ timeout: 5000 });
  }

  /**
   * 할 일 삭제
   */
  async deleteTodo(title: string) {
    const todoItem = this.getTodoItem(title);
    const deleteButton = todoItem.locator('[data-testid="delete-button"]');
    
    await deleteButton.click();
    
    // 삭제가 완료될 때까지 대기
    await expect(todoItem).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * 필터 적용
   */
  async applyFilter(filterType: FilterType) {
    const filterButton = this.page.locator(`[data-testid="filter-${filterType}"]`);
    await filterButton.click();
    
    // 필터 적용이 완료될 때까지 대기
    await this.page.waitForTimeout(300);
  }

  /**
   * 정렬 옵션 선택
   */
  async sortBy(sortBy: SortBy, sortOrder: SortOrder = 'desc') {
    // 정렬 기준 선택
    const sortBySelect = this.page.locator('[data-testid="sort-by-select"]');
    await sortBySelect.click();
    await this.page.waitForSelector('[role="listbox"]', { timeout: 5000 });
    
    // sortBy 값에 따른 텍스트 매핑
    const sortByText = sortBy === 'createdAt' ? '생성일' : sortBy === 'priority' ? '우선순위' : '제목';
    await this.page.locator(`[role="option"]:has-text("${sortByText}")`).click();
    
    // 정렬 순서 선택
    const sortOrderSelect = this.page.locator('[data-testid="sort-order-select"]');
    await sortOrderSelect.click();
    await this.page.waitForSelector('[role="listbox"]', { timeout: 5000 });
    
    // sortOrder 값에 따른 텍스트 매핑
    const sortOrderText = sortOrder === 'desc' ? '내림차순' : '오름차순';
    await this.page.locator(`[role="option"]:has-text("${sortOrderText}")`).click();
    
    // 정렬이 적용될 때까지 대기
    await this.page.waitForTimeout(300);
  }

  /**
   * 검색 실행
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300); // 검색 디바운싱 대기
  }

  /**
   * 모든 할 일 제목 가져오기
   */
  async getAllTodoTitles(): Promise<string[]> {
    const todoItems = await this.page.locator('[data-testid="todo-item"]').all();
    const titles: string[] = [];
    
    for (const item of todoItems) {
      const title = await item.locator('[data-testid="todo-title"]').textContent();
      if (title) {
        titles.push(title);
      }
    }
    
    return titles;
  }

  /**
   * 통계 정보 가져오기
   */
  async getStats(): Promise<TodoStats> {
    const totalElement = this.page.locator('[data-testid="stats-total"]');
    const activeElement = this.page.locator('[data-testid="stats-active"]');
    const completedElement = this.page.locator('[data-testid="stats-completed"]');
    const completionRateElement = this.page.locator('[data-testid="stats-completion-rate"]');

    const [total, active, completed, completionRate] = await Promise.all([
      totalElement.textContent().then(text => parseInt(text || '0')),
      activeElement.textContent().then(text => parseInt(text || '0')),
      completedElement.textContent().then(text => parseInt(text || '0')),
      completionRateElement.textContent().then(text => parseInt((text || '0').replace('%', ''))),
    ]);

    return { total, active, completed, completionRate };
  }

  /**
   * 통계가 예상값과 일치하는지 확인
   */
  async expectStatsToEqual(expectedStats: TodoStats) {
    const actualStats = await this.getStats();
    
    expect(actualStats.total).toBe(expectedStats.total);
    expect(actualStats.active).toBe(expectedStats.active);
    expect(actualStats.completed).toBe(expectedStats.completed);
    expect(actualStats.completionRate).toBe(expectedStats.completionRate);
  }

  /**
   * 페이지 스크린샷 촬영
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `screenshots/${name}.png`,
      fullPage: true
    });
  }

  /**
   * 로딩 상태 대기
   */
  async waitForLoading() {
    const loadingSpinner = this.page.locator('[data-testid="loading-spinner"]');
    
    // 로딩 스피너가 나타났다가 사라질 때까지 대기
    try {
      await expect(loadingSpinner).toBeVisible({ timeout: 1000 });
      await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
    } catch {
      // 로딩 스피너가 없으면 그냥 진행
    }
  }

  /**
   * 에러 메시지 확인
   */
  async expectErrorMessage(message: string) {
    const errorElement = this.page.locator('[data-testid="error-message"]');
    await expect(errorElement).toContainText(message);
  }

  /**
   * 성공 메시지 확인
   */
  async expectSuccessMessage(message: string) {
    const successElement = this.page.locator('[data-testid="success-message"]');
    await expect(successElement).toContainText(message);
  }
}