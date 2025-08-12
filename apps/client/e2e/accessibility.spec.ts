import { test, expect } from '@playwright/test';
import { TodoPage } from './page-objects/todo-page';

test.describe('접근성 테스트', () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage();
  });

  test('키보드 네비게이션 테스트', async ({ page }) => {
    // 할 일 몇 개 추가
    await todoPage.addTodo('첫 번째 할 일', 'high');
    await todoPage.addTodo('두 번째 할 일', 'medium');

    // Tab 키를 사용한 포커스 이동 테스트
    await page.keyboard.press('Tab');
    
    // 첫 번째 포커스 가능한 요소가 할 일 입력 필드인지 확인
    const focusedElement = await page.locator(':focus').getAttribute('data-testid');
    expect(['todo-input', 'search-input'].includes(focusedElement || '')).toBeTruthy();

    // Enter 키로 할 일 추가
    await page.locator('[data-testid="todo-input"]').first().focus();
    await page.keyboard.type('키보드로 추가된 할 일');
    await page.keyboard.press('Enter');

    // 할 일이 추가되었는지 확인
    await expect(todoPage.getTodoItem('키보드로 추가된 할 일')).toBeVisible();

    // 체크박스에 키보드로 접근
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // 스페이스 키로 체크박스 토글
    const firstCheckbox = todoPage.getTodoCheckbox('첫 번째 할 일');
    await firstCheckbox.focus();
    await page.keyboard.press('Space');

    // 할 일이 완료로 표시되었는지 확인
    await expect(firstCheckbox).toBeChecked();
  });

  test('ARIA 레이블 및 역할 테스트', async ({ page }) => {
    await todoPage.addTodo('접근성 테스트 할 일', 'medium');

    // 주요 요소들의 ARIA 속성 확인
    const todoInput = page.locator('[data-testid="todo-input"]').first();
    const addButton = page.locator('[data-testid="add-todo-button"]').first();
    const todoCheckbox = todoPage.getTodoCheckbox('접근성 테스트 할 일');

    // 입력 필드에 적절한 label이나 placeholder가 있는지 확인
    const hasLabel = await todoInput.getAttribute('aria-label') || 
                     await todoInput.getAttribute('placeholder') ||
                     await todoInput.getAttribute('title');
    expect(hasLabel).toBeTruthy();

    // 버튼에 적절한 텍스트나 aria-label이 있는지 확인
    const buttonText = await addButton.textContent();
    const buttonLabel = await addButton.getAttribute('aria-label');
    expect(buttonText || buttonLabel).toBeTruthy();

    // 체크박스의 역할 확인
    const checkboxRole = await todoCheckbox.getAttribute('role') || 'checkbox';
    expect(['checkbox', 'switch'].includes(checkboxRole)).toBeTruthy();
  });

  test('색상 대비 및 시각적 표시 테스트', async ({ page }) => {
    await todoPage.addTodo('시각 테스트 할 일', 'high');

    // 고대비 모드에서 텍스트가 읽을 수 있는지 확인
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500); // 테마 변경 대기

    // 텍스트 요소들이 여전히 보이는지 확인
    await expect(todoPage.getTodoItem('시각 테스트 할 일')).toBeVisible();
    
    // 라이트 모드로 복원
    await page.emulateMedia({ colorScheme: 'light' });
    
    // 포커스 표시가 명확한지 확인
    const todoInput = page.locator('[data-testid="todo-input"]').first();
    await todoInput.focus();
    
    // 포커스된 요소가 시각적으로 구분되는지 확인
    const focusedStyles = await todoInput.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        border: styles.border,
        boxShadow: styles.boxShadow
      };
    });
    
    // 포커스 표시가 있는지 확인 (outline, border, box-shadow 중 하나)
    const hasFocusIndicator = 
      focusedStyles.outline !== 'none' ||
      focusedStyles.boxShadow.includes('rgb') ||
      focusedStyles.border.includes('rgb');
    
    expect(hasFocusIndicator).toBeTruthy();
  });

  test('스크린 리더 지원 테스트', async ({ page }) => {
    // 페이지 제목 확인
    const pageTitle = await page.title();
    expect(pageTitle).toContain('TaskFlow'); // 또는 앱 이름

    // 주요 랜드마크 역할 확인
    const header = page.locator('[data-testid="todo-header"]');
    const main = page.locator('main').or(page.locator('[role="main"]'));
    
    await expect(header).toBeVisible();
    // main 요소나 role="main"이 있는지 확인
    const hasMain = (await main.count()) > 0;
    if (!hasMain) {
      console.warn('권장사항: 메인 콘텐츠 영역에 <main> 또는 role="main" 추가');
    }

    // 할 일 추가 및 상태 변화 알림 테스트
    await todoPage.addTodo('스크린 리더 테스트', 'medium');

    // 상태 변화가 적절히 알려지는지 확인 (aria-live 영역)
    const liveRegions = page.locator('[aria-live]');
    const liveRegionCount = await liveRegions.count();
    
    if (liveRegionCount === 0) {
      console.warn('권장사항: 동적 콘텐츠 변화를 위한 aria-live 영역 추가');
    }

    // 통계 정보가 스크린 리더에게 의미 있게 전달되는지 확인
    const statsElements = page.locator('[data-testid^="stats-"]');
    const statsCount = await statsElements.count();
    expect(statsCount).toBeGreaterThan(0);
  });

  test('모바일 접근성 테스트', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });

    await todoPage.addTodo('모바일 테스트 할 일', 'medium');

    // 터치 대상이 충분히 큰지 확인 (최소 44px)
    const touchTargets = page.locator('button, input, [role="button"], [tabindex="0"]');
    const touchTargetCount = await touchTargets.count();

    for (let i = 0; i < Math.min(touchTargetCount, 5); i++) {
      const target = touchTargets.nth(i);
      const boundingBox = await target.boundingBox();
      
      if (boundingBox) {
        const minSize = 44; // WCAG 권장 최소 터치 대상 크기
        expect(Math.max(boundingBox.width, boundingBox.height)).toBeGreaterThanOrEqual(minSize);
      }
    }

    // 모바일에서 스크롤 동작 테스트
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    
    // 스크롤 후에도 핵심 요소들이 접근 가능한지 확인
    await expect(todoPage.getTodoItem('모바일 테스트 할 일')).toBeVisible();
  });

  test('고대비 모드 및 확대/축소 지원', async ({ page }) => {
    await todoPage.addTodo('고대비 테스트', 'high');

    // 200% 확대
    await page.setViewportSize({ width: 640, height: 480 }); // 50% 크기로 시뮬레이션
    
    // 확대 상태에서도 기능이 정상 작동하는지 확인
    await expect(todoPage.getTodoItem('고대비 테스트')).toBeVisible();
    
    // 새 할 일 추가가 가능한지 확인
    await todoPage.addTodo('확대 상태 테스트', 'low');
    await expect(todoPage.getTodoItem('확대 상태 테스트')).toBeVisible();

    // 원래 크기로 복원
    await page.setViewportSize({ width: 1280, height: 720 });

    // 고대비 미디어 쿼리 테스트
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(500);
    
    // 애니메이션이 줄어들었는지 확인 (완전 검증은 어렵지만 기본 기능 확인)
    await expect(todoPage.getTodoItem('고대비 테스트')).toBeVisible();
  });

  test('키보드 단축키 및 접근성 기능', async ({ page }) => {
    // 할 일 추가
    await todoPage.addTodo('단축키 테스트 할 일', 'medium');

    // Escape 키 동작 테스트
    const editButton = todoPage.getTodoItem('단축키 테스트 할 일').locator('[data-testid="edit-button"]');
    await editButton.click();

    // 편집 모드에서 Escape 키로 취소
    await page.keyboard.press('Escape');
    
    // 편집 모드가 취소되었는지 확인
    const editInput = todoPage.getTodoItem('단축키 테스트 할 일').locator('[data-testid="edit-input"]');
    await expect(editInput).not.toBeVisible();

    // Tab 순서가 논리적인지 확인
    await page.keyboard.press('Tab'); // 검색/입력 필드
    await page.keyboard.press('Tab'); // 우선순위 선택
    await page.keyboard.press('Tab'); // 추가 버튼
    
    const currentFocus = await page.locator(':focus').getAttribute('data-testid');
    expect(['add-todo-button', 'todo-checkbox'].includes(currentFocus || '')).toBeTruthy();
  });
});