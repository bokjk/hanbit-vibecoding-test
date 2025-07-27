# 📚 React TODO 앱 테스트 완벽 가이드

> **목표**: 개발자가 유닛 테스트와 E2E 테스트를 완전히 이해하고 직접 작성할 수 있도록 돕는 실용적인 가이드

## 📋 목차

1. [테스트 개요](#1-테스트-개요)
2. [환경 설정](#2-환경-설정)
3. [유닛 테스트 (Vitest)](#3-유닛-테스트-vitest)
4. [E2E 테스트 (Playwright)](#4-e2e-테스트-playwright)
5. [실전 예제](#5-실전-예제)
6. [디버깅 및 트러블슈팅](#6-디버깅-및-트러블슈팅)
7. [모범 사례](#7-모범-사례)

---

## 1. 테스트 개요

### 🤔 왜 테스트를 작성해야 할까?

```
실제 상황: 컴포넌트를 수정했는데 다른 기능이 갑자기 안 됨 😱
테스트 있음: 5초 만에 어디가 문제인지 정확히 알 수 있음 ✅
테스트 없음: 30분 디버깅 후 원인 발견... 😭
```

### 🎯 테스트 종류

| 테스트 종류 | 목적 | 도구 | 실행 속도 | 범위 |
|------------|------|------|----------|------|
| **유닛 테스트** | 개별 함수/컴포넌트 검증 | Vitest | ⚡ 빠름 | 작음 |
| **E2E 테스트** | 전체 사용자 흐름 검증 | Playwright | 🐌 느림 | 큼 |

---

## 2. 환경 설정

### 🛠️ 현재 프로젝트 구조

```
apps/client/
├── src/
│   ├── components/           # React 컴포넌트
│   ├── contexts/            # React Context & 유닛 테스트
│   │   ├── todo.reducer.ts       # 비즈니스 로직
│   │   └── todo.reducer.test.ts  # 유닛 테스트 ✅
│   └── services/            # 서비스 & 유닛 테스트
│       ├── localStorage.service.ts
│       └── localStorage.service.test.ts ✅
├── e2e/                     # E2E 테스트
│   ├── page-objects/        # Page Object 패턴
│   ├── todo-app.spec.ts     # E2E 테스트 ✅
│   └── performance.spec.ts  # 성능 테스트 ✅
├── vitest.config.ts         # 유닛 테스트 설정
└── playwright.config.ts     # E2E 테스트 설정
```

### 📦 설치된 패키지

```json
{
  "devDependencies": {
    "@playwright/test": "^1.54.1",  // E2E 테스트
    "vitest": "^3.2.4",             // 유닛 테스트
    "jsdom": "^26.1.0"              // DOM 시뮬레이션
  }
}
```

### ⚙️ 설정 파일 이해

#### `vitest.config.ts` - 유닛 테스트 설정
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',           // 브라우저 DOM 시뮬레이션
    exclude: [
      '**/e2e/**',                  // E2E 폴더 제외
      '**/*.spec.ts'                // .spec.ts 파일 제외 (E2E용)
    ],
    include: [
      '**/*.test.ts'                // .test.ts 파일만 포함 (유닛용)
    ]
  },
});
```

#### `playwright.config.ts` - E2E 테스트 설정
```typescript
export default defineConfig({
  testDir: './e2e',                // E2E 테스트 디렉토리
  webServer: {
    command: 'npm run dev',         // 테스트 전 개발 서버 자동 시작
    url: 'http://localhost:5173',
    reuseExistingServer: true
  },
  projects: [
    { name: 'chromium' },           // 크롬 브라우저
    { name: 'firefox' },            // 파이어폭스 브라우저
    { name: 'Mobile Chrome' }       // 모바일 크롬
  ]
});
```

---

## 3. 유닛 테스트 (Vitest)

### 🎯 유닛 테스트란?

**"개별 함수나 컴포넌트가 예상대로 동작하는지 검증"**

### 📚 기본 문법

```typescript
import { describe, it, expect } from 'vitest';

describe('테스트 그룹 이름', () => {
  it('구체적인 테스트 케이스 설명', () => {
    // 준비 (Arrange)
    const input = 'test';
    
    // 실행 (Act)
    const result = someFunction(input);
    
    // 검증 (Assert)
    expect(result).toBe('expected');
  });
});
```

### 🔍 주요 Matcher들

```typescript
// 값 비교
expect(value).toBe(5);                    // 정확히 같음 (===)
expect(value).toEqual({ a: 1 });          // 깊은 비교 (객체/배열)
expect(value).not.toBe(3);                // 같지 않음

// 불린
expect(value).toBeTruthy();               // true로 평가됨
expect(value).toBeFalsy();                // false로 평가됨

// 배열/객체
expect(array).toHaveLength(3);            // 길이 확인
expect(array).toContain('item');          // 포함 여부
expect(object).toHaveProperty('key');     // 속성 존재

// 함수
expect(fn).toThrow();                     // 에러 발생
expect(fn).toHaveBeenCalled();            // 호출됨 (Mock)
```

### 🏗️ 실제 유닛 테스트 예제

#### 1) Reducer 테스트 (State 관리 로직)

```typescript
// src/contexts/todo.reducer.test.ts
import { describe, it, expect } from 'vitest';
import { todoReducer } from './todo.reducer';
import type { TodoState, TodoAction } from './todo.reducer';

describe('todoReducer', () => {
  // 테스트용 초기 상태
  const initialState: TodoState = {
    todos: [],
    loading: false,
    error: null,
  };

  // 테스트용 더미 데이터
  const mockTodo = {
    id: '1',
    title: 'Test Todo',
    completed: false,
    priority: 'medium',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  describe('ADD_TODO 액션', () => {
    it('새로운 할 일을 상태에 추가해야 함', () => {
      // 준비: 액션 객체 생성
      const action: TodoAction = {
        type: 'ADD_TODO',
        payload: mockTodo,
      };

      // 실행: 리듀서 함수 호출
      const newState = todoReducer(initialState, action);

      // 검증: 결과 확인
      expect(newState.todos).toHaveLength(1);
      expect(newState.todos[0].title).toBe(mockTodo.title);
      expect(newState.loading).toBe(false);
      expect(newState.error).toBeNull();
    });

    it('빈 제목으로는 할 일을 추가하지 않아야 함', () => {
      const action: TodoAction = {
        type: 'ADD_TODO',
        payload: { ...mockTodo, title: '' },
      };

      const newState = todoReducer(initialState, action);

      // 빈 제목일 때는 추가되지 않아야 함
      expect(newState.todos).toHaveLength(0);
    });
  });

  describe('TOGGLE_TODO 액션', () => {
    it('할 일의 완료 상태를 토글해야 함', () => {
      // 준비: 할 일이 이미 있는 상태
      const stateWithTodo: TodoState = {
        ...initialState,
        todos: [mockTodo]
      };

      const action: TodoAction = {
        type: 'TOGGLE_TODO',
        payload: { id: '1' }
      };

      // 실행
      const newState = todoReducer(stateWithTodo, action);

      // 검증: 완료 상태가 반대로 변경됨
      expect(newState.todos[0].completed).toBe(true);
    });
  });
});
```

#### 2) Service 테스트 (로컬 스토리지)

```typescript
// src/services/localStorage.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageService } from './localStorage.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    // 각 테스트 전에 초기화
    service = new LocalStorageService();
    localStorage.clear(); // 로컬스토리지 초기화
  });

  describe('saveTodos', () => {
    it('할 일 목록을 로컬스토리지에 저장해야 함', async () => {
      const todos = [
        { id: '1', title: '테스트 할 일', completed: false }
      ];

      await service.saveTodos(todos);

      // 로컬스토리지에 실제로 저장되었는지 확인
      const saved = localStorage.getItem('todos');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(todos);
    });
  });

  describe('getTodos', () => {
    it('로컬스토리지에서 할 일 목록을 불러와야 함', async () => {
      // 준비: 미리 데이터 저장
      const todos = [{ id: '1', title: '테스트' }];
      localStorage.setItem('todos', JSON.stringify(todos));

      // 실행
      const result = await service.getTodos();

      // 검증
      expect(result).toEqual(todos);
    });

    it('로컬스토리지가 비어있으면 빈 배열을 반환해야 함', async () => {
      const result = await service.getTodos();
      expect(result).toEqual([]);
    });
  });
});
```

### 🚀 유닛 테스트 실행

```bash
# 모든 유닛 테스트 실행
npm run test

# 파일 변경 감지하며 실행 (개발 중)
npx vitest

# 특정 파일만 테스트
npx vitest todo.reducer.test.ts

# 커버리지 포함 실행
npx vitest --coverage
```

---

## 4. E2E 테스트 (Playwright)

### 🎯 E2E 테스트란?

**"실제 사용자가 브라우저에서 앱을 사용하는 것처럼 전체 흐름을 테스트"**

### 🏗️ Page Object 패턴

**문제**: 테스트 코드에서 직접 선택자 사용하면 중복과 유지보수 어려움
**해결**: Page Object로 추상화

```typescript
// e2e/page-objects/todo-page.ts
export class TodoPage {
  readonly page: Page;
  readonly todoInput: Locator;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.todoInput = page.locator('[data-testid="todo-input"]').first();
    this.addButton = page.locator('[data-testid="add-todo-button"]').first();
  }

  // 페이지로 이동
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  // 할 일 추가 (비즈니스 로직 캡슐화)
  async addTodo(title: string, priority: Priority = 'medium') {
    await this.todoInput.fill(title);
    await this.prioritySelect.click();
    await this.page.locator(`[data-value="${priority}"]`).click();
    await this.addButton.click();
    
    if (title.trim()) {
      await this.page.waitForTimeout(500); // 추가 완료 대기
    }
  }

  // 통계 검증
  async expectStatsToEqual(expectedStats: TodoStats) {
    const actualStats = await this.getStats();
    expect(actualStats.total).toBe(expectedStats.total);
    expect(actualStats.active).toBe(expectedStats.active);
    expect(actualStats.completed).toBe(expectedStats.completed);
  }
}
```

### 🔍 주요 Playwright API

```typescript
// 페이지 조작
await page.goto('http://localhost:5173');
await page.reload();
await page.goBack();

// 요소 선택
page.locator('[data-testid="todo-input"]')     // 속성으로
page.locator('text=TaskFlow')                  // 텍스트로
page.locator('button:has-text("추가")')        // 조건으로
page.locator('input').first()                  // 첫 번째 요소
page.locator('input').nth(1)                   // n번째 요소

// 상호작용
await input.fill('새로운 할 일');              // 텍스트 입력
await button.click();                          // 클릭
await select.selectOption('medium');           // 선택
await element.hover();                         // 마우스 오버

// 대기
await page.waitForTimeout(1000);               // 시간 대기
await page.waitForSelector('[data-testid="result"]'); // 요소 대기
await page.waitForLoadState('networkidle');    // 네트워크 완료 대기

// 검증
await expect(element).toBeVisible();           // 보임
await expect(element).toHaveText('예상 텍스트'); // 텍스트 확인
await expect(element).toHaveClass('active');   // CSS 클래스
await expect(element).toBeChecked();           // 체크됨 (체크박스)
```

### 🏗️ 실제 E2E 테스트 예제

```typescript
// e2e/todo-app.spec.ts
import { test, expect } from '@playwright/test';
import { TodoPage } from './page-objects/todo-page';

test.describe('TODO 앱 핵심 기능 테스트', () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.clearStorage(); // 매번 깨끗한 상태로 시작
  });

  test('애플리케이션이 성공적으로 로드되어야 함', async ({ page }) => {
    // 헤더가 보이는지 확인
    await expect(page.locator('[data-testid="todo-header"]')).toBeVisible();
    await expect(page.locator('text=TaskFlow')).toBeVisible();
    
    // 대시보드가 보이는지 확인
    await expect(page.locator('[data-testid="todo-dashboard"]')).toBeVisible();
    
    // 빈 상태 메시지 확인
    await expect(page.locator('h3:has-text("할 일이 없습니다")')).toBeVisible();
  });

  test('새로운 할 일을 추가할 수 있어야 함', async () => {
    const todoTitle = '첫 번째 할 일';
    
    // Page Object 메서드 사용
    await todoPage.addTodo(todoTitle, 'medium');
    
    // 할 일이 목록에 표시되는지 확인
    await expect(todoPage.getTodoItem(todoTitle)).toBeVisible();
    
    // 통계가 업데이트되었는지 확인
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

    // 우선순위 배지가 올바르게 표시되는지 확인
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
```

### 🚀 E2E 테스트 실행

```bash
# 모든 E2E 테스트 실행
npm run test:e2e

# UI 모드로 실행 (시각적으로 확인 가능)
npm run test:e2e:ui

# 브라우저를 보면서 실행 (디버깅용)
npm run test:e2e:headed

# 특정 브라우저만 실행
npx playwright test --project=chromium

# 특정 파일만 실행
npx playwright test todo-app.spec.ts

# 테스트 결과 리포트 보기
npm run test:e2e:report
```

---

## 5. 실전 예제

### 🎯 시나리오: 새로운 기능 추가 시 테스트 작성

**요구사항**: "할 일에 태그 기능 추가"

#### 1단계: 유닛 테스트부터 작성 (TDD)

```typescript
// src/contexts/todo.reducer.test.ts
describe('ADD_TAG 액션', () => {
  it('할 일에 태그를 추가해야 함', () => {
    const stateWithTodo = {
      ...initialState,
      todos: [{ ...mockTodo, tags: [] }]
    };

    const action = {
      type: 'ADD_TAG',
      payload: { id: '1', tag: '업무' }
    };

    const newState = todoReducer(stateWithTodo, action);

    expect(newState.todos[0].tags).toContain('업무');
    expect(newState.todos[0].tags).toHaveLength(1);
  });

  it('중복 태그는 추가하지 않아야 함', () => {
    const stateWithTodo = {
      ...initialState,
      todos: [{ ...mockTodo, tags: ['업무'] }]
    };

    const action = {
      type: 'ADD_TAG',
      payload: { id: '1', tag: '업무' }
    };

    const newState = todoReducer(stateWithTodo, action);

    expect(newState.todos[0].tags).toHaveLength(1); // 중복 추가 안됨
  });
});
```

#### 2단계: 실제 구현

```typescript
// src/contexts/todo.reducer.ts
export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TAG':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload.id
            ? {
                ...todo,
                tags: todo.tags?.includes(action.payload.tag)
                  ? todo.tags // 중복이면 그대로
                  : [...(todo.tags || []), action.payload.tag] // 추가
              }
            : todo
        )
      };
    // ... 다른 케이스들
  }
}
```

#### 3단계: E2E 테스트 추가

```typescript
// e2e/todo-app.spec.ts
test('할 일에 태그를 추가할 수 있어야 함', async () => {
  // 할 일 추가
  await todoPage.addTodo('태그 테스트 할 일', 'medium');
  
  // 태그 추가
  await todoPage.addTag('태그 테스트 할 일', '업무');
  
  // 태그가 표시되는지 확인
  const todoItem = todoPage.getTodoItem('태그 테스트 할 일');
  await expect(todoItem.locator('[data-testid="tag"]:has-text("업무")')).toBeVisible();
});
```

#### 4단계: Page Object 업데이트

```typescript
// e2e/page-objects/todo-page.ts
export class TodoPage {
  // ... 기존 코드 ...

  async addTag(todoTitle: string, tag: string) {
    const todoItem = this.getTodoItem(todoTitle);
    await todoItem.locator('[data-testid="add-tag-button"]').click();
    await todoItem.locator('[data-testid="tag-input"]').fill(tag);
    await todoItem.locator('[data-testid="confirm-tag-button"]').click();
  }

  getTag(todoTitle: string, tagName: string) {
    const todoItem = this.getTodoItem(todoTitle);
    return todoItem.locator(`[data-testid="tag"]:has-text("${tagName}")`);
  }
}
```

---

## 6. 디버깅 및 트러블슈팅

### 🐛 유닛 테스트 디버깅

#### 흔한 문제 1: Mock이 작동하지 않음

```typescript
// ❌ 잘못된 예
import { vi } from 'vitest';
const mockFn = vi.fn();
// 테스트에서 mockFn이 호출되지 않음

// ✅ 올바른 예
import { vi, beforeEach } from 'vitest';

describe('테스트', () => {
  const mockFn = vi.fn();

  beforeEach(() => {
    mockFn.mockClear(); // 각 테스트 전에 mock 초기화
  });
});
```

#### 흔한 문제 2: 비동기 처리

```typescript
// ❌ 잘못된 예
test('비동기 함수 테스트', () => {
  const result = asyncFunction();
  expect(result).toBe('expected'); // Promise가 반환됨
});

// ✅ 올바른 예
test('비동기 함수 테스트', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

### 🐛 E2E 테스트 디버깅

#### 흔한 문제 1: 요소를 찾을 수 없음

```typescript
// ❌ 문제가 있는 선택자
await page.locator('button').click(); // 여러 버튼 중 어느 것?

// ✅ 구체적인 선택자
await page.locator('[data-testid="add-todo-button"]').click();
await page.locator('button:has-text("할 일 추가")').click();
```

#### 흔한 문제 2: 타이밍 이슈

```typescript
// ❌ 요소가 나타나기 전에 클릭 시도
await page.click('[data-testid="submit"]');

// ✅ 요소가 나타날 때까지 대기
await page.waitForSelector('[data-testid="submit"]');
await page.click('[data-testid="submit"]');

// 🎯 더 좋은 방법: Playwright의 자동 대기 사용
await expect(page.locator('[data-testid="submit"]')).toBeVisible();
await page.locator('[data-testid="submit"]').click();
```

#### 흔한 문제 3: Strict Mode Violation (중복 요소)

```typescript
// ❌ 에러: 2개 요소 발견
await page.locator('[data-testid="todo-input"]').fill('할 일');

// ✅ 해결책 1: 첫 번째 요소 선택
await page.locator('[data-testid="todo-input"]').first().fill('할 일');

// ✅ 해결책 2: 더 구체적인 선택자
await page.locator('[data-testid="desktop-todo-input"]').fill('할 일');
```

### 🔍 디버깅 도구

```bash
# E2E 테스트를 브라우저에서 보면서 실행
npm run test:e2e:headed

# 테스트 중간에 멈춰서 디버깅
npm run test:e2e:debug

# 스크린샷과 비디오로 확인
npm run test:e2e:report
```

---

## 7. 모범 사례

### ✅ 유닛 테스트 모범 사례

#### 1. 테스트 이름은 구체적으로
```typescript
// ❌ 모호함
test('add function', () => {});

// ✅ 구체적
test('두 양수를 더하면 올바른 합을 반환해야 함', () => {});
test('빈 문자열이 주어지면 에러를 발생시켜야 함', () => {});
```

#### 2. AAA 패턴 사용
```typescript
test('할 일 추가 테스트', () => {
  // Arrange (준비)
  const initialState = { todos: [] };
  const newTodo = { title: '테스트 할 일' };

  // Act (실행)
  const result = addTodo(initialState, newTodo);

  // Assert (검증)
  expect(result.todos).toHaveLength(1);
  expect(result.todos[0].title).toBe('테스트 할 일');
});
```

#### 3. 한 번에 하나만 검증
```typescript
// ❌ 너무 많은 것을 한 번에 검증
test('사용자 등록', () => {
  const user = registerUser(userData);
  expect(user.id).toBeDefined();
  expect(user.email).toBe(userData.email);
  expect(user.isActive).toBe(true);
  expect(user.createdAt).toBeInstanceOf(Date);
  // ... 10줄 더
});

// ✅ 개별 테스트로 분리
test('사용자 등록 시 고유 ID가 생성되어야 함', () => {
  const user = registerUser(userData);
  expect(user.id).toBeDefined();
});

test('사용자 등록 시 이메일이 정확히 저장되어야 함', () => {
  const user = registerUser(userData);
  expect(user.email).toBe(userData.email);
});
```

### ✅ E2E 테스트 모범 사례

#### 1. data-testid 사용
```typescript
// ❌ 불안정한 선택자
page.locator('.btn-primary.large')
page.locator('div > button:nth-child(2)')

// ✅ 안정적인 선택자
page.locator('[data-testid="add-todo-button"]')
page.locator('[data-testid="todo-item"][data-id="123"]')
```

#### 2. Page Object 패턴 활용
```typescript
// ❌ 테스트에서 직접 DOM 조작
test('할 일 추가', async ({ page }) => {
  await page.locator('[data-testid="todo-input"]').fill('새 할 일');
  await page.locator('[data-testid="priority-select"]').click();
  await page.locator('[data-value="high"]').click();
  await page.locator('[data-testid="add-button"]').click();
  // 중복 코드...
});

// ✅ Page Object로 추상화
test('할 일 추가', async ({ page }) => {
  await todoPage.addTodo('새 할 일', 'high');
  await expect(todoPage.getTodoItem('새 할 일')).toBeVisible();
});
```

#### 3. 독립적인 테스트 작성
```typescript
// ❌ 테스트끼리 의존성 있음
test('할 일 추가', async () => {
  await todoPage.addTodo('할 일 1');
  // 다음 테스트가 이 상태에 의존
});

test('할 일 완료', async () => {
  // 이전 테스트에서 추가한 '할 일 1'이 있다고 가정
  await todoPage.toggleTodo('할 일 1');
});

// ✅ 각 테스트는 독립적
test('할 일 추가', async () => {
  await todoPage.addTodo('할 일 1');
  await expect(todoPage.getTodoItem('할 일 1')).toBeVisible();
});

test('할 일 완료', async () => {
  // 테스트에 필요한 상태를 직접 생성
  await todoPage.addTodo('완료할 할 일');
  await todoPage.toggleTodo('완료할 할 일');
  await expect(todoPage.getTodoCheckbox('완료할 할 일')).toBeChecked();
});
```

### 📊 테스트 커버리지 목표

| 테스트 유형 | 목표 커버리지 | 우선순위 |
|------------|--------------|----------|
| **핵심 비즈니스 로직** | 90%+ | 🔥 매우 높음 |
| **유틸리티 함수** | 80%+ | 🔥 높음 |
| **UI 컴포넌트** | 60%+ | 📊 보통 |
| **설정/환경 파일** | 30%+ | 📊 낮음 |

### 🎯 테스트 전략

```
피라미드 모델:
    E2E (10%) - 핵심 사용자 흐름
   Integration (20%) - 컴포넌트 간 연동
  Unit Tests (70%) - 개별 함수/컴포넌트
```

---

## 8. 실행 명령어 치트시트

### 🚀 개발 중 자주 사용하는 명령어

```bash
# 📦 설치 및 설정
npm install                          # 의존성 설치
npx playwright install               # E2E 브라우저 설치

# 🧪 유닛 테스트
npm run test                         # 모든 유닛 테스트 실행
npx vitest                          # 파일 변경 감지 모드
npx vitest --coverage               # 커버리지 포함
npx vitest todo.reducer.test.ts     # 특정 파일만

# 🌐 E2E 테스트
npm run test:e2e                    # 모든 E2E 테스트
npm run test:e2e:ui                 # UI 모드 (시각적)
npm run test:e2e:headed             # 브라우저 보기
npm run test:e2e:debug              # 디버그 모드
npm run test:e2e:report             # 결과 리포트

# 🎯 통합 실행
npm run test:all                    # 유닛 + E2E 모두
npm run dev                         # 개발 서버 시작
```

### 🔧 문제 해결용 명령어

```bash
# 캐시 정리
rm -rf node_modules/.cache
npx vitest --run --clear-cache

# E2E 테스트 재설정
npx playwright install --force
rm -rf test-results/

# 특정 브라우저만 테스트
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

---

## 9. 다음 단계

### 🎓 학습 로드맵

1. **현재 프로젝트 테스트 실행해보기** (30분)
   - `npm run test:all` 실행
   - 결과 확인 및 이해

2. **간단한 유닛 테스트 작성** (1시간)
   - 새로운 유틸리티 함수 만들기
   - 해당 함수의 테스트 작성

3. **E2E 테스트 케이스 추가** (2시간)
   - 기존 todo-app.spec.ts에 새로운 시나리오 추가
   - Page Object 메서드 추가

4. **TDD 연습** (1주)
   - 새로운 기능을 테스트부터 작성하여 개발

### 📚 추가 학습 자료

- [Vitest 공식 문서](https://vitest.dev/)
- [Playwright 공식 문서](https://playwright.dev/)
- [Testing Library 가이드](https://testing-library.com/)
- [TDD 연습 프로젝트](https://github.com/testdouble/contributing-tests)

---

## 📞 도움이 필요할 때

1. **에러 메시지를 읽어보세요** - 대부분의 해답이 있습니다
2. **공식 문서를 확인하세요** - 예제가 풍부합니다
3. **커뮤니티에 질문하세요** - Stack Overflow, Discord 등

**이 가이드를 통해 테스트 작성이 더 이상 두렵지 않기를 바랍니다! 🎉**

---

*마지막 업데이트: 2025년 1월*
*작성자: Claude AI Assistant*