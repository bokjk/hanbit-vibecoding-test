# 테스트 전략 규칙

> **참조 설계 문서**: 
> - [테스트 전략](../docs/design/10-testing.md) - 테스트 피라미드, TDD/BDD 방식, E2E 테스트
> - [문서 개요](../docs/design/01-overview.md) - 테스트 도구 (Jest, React Testing Library)

## 🎯 개발 접근법

### 백엔드 개발 (TDD 필수)
**반드시 TDD 방식을 사용하세요:**
1. **Red**: 실패하는 테스트를 먼저 작성하세요
2. **Green**: 테스트를 통과하는 최소 코드를 구현하세요
3. **Refactor**: 테스트를 유지하면서 리팩토링하세요

```typescript
// ✅ TDD 예시: 백엔드 서비스
describe('TodoService', () => {
  it('should create a new todo with valid data', async () => {
    // Given
    const todoData = { title: 'Test Todo', completed: false };
    
    // When
    const result = await todoService.create(todoData);
    
    // Then
    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test Todo');
    expect(result.completed).toBe(false);
  });
});
```

### 프론트엔드 개발 (구현 우선)
**구현 우선 접근법을 사용하세요:**
1. 동작하는 UI 컴포넌트를 먼저 구축하세요
2. 안정성을 위해 나중에 테스트를 추가하세요
3. 사용자 상호작용 테스트에 집중하세요

## 🧪 테스트 도구

### 단위 테스트
- **Vitest**로 단위 테스트를 작성하세요
- 90% 테스트 커버리지를 목표로 하세요
- 외부 의존성은 적절히 모킹하세요

### 컴포넌트 테스트
- **React Testing Library**를 사용하세요
- 사용자 관점에서 테스트를 작성하세요

```typescript
// ✅ React 컴포넌트 테스트 예시
import { render, screen, fireEvent } from '@testing-library/react';
import { TodoItem } from './todo-item';

describe('TodoItem', () => {
  it('should toggle todo completion when clicked', () => {
    // Given
    const todo = { id: '1', title: 'Test Todo', completed: false };
    const onToggle = vi.fn();
    render(<TodoItem todo={todo} onToggle={onToggle} />);
    
    // When
    fireEvent.click(screen.getByRole('checkbox'));
    
    // Then
    expect(onToggle).toHaveBeenCalledWith('1');
  });
});
```

## 📋 테스트 구조

### Given-When-Then 패턴
```typescript
describe('기능 설명', () => {
  it('should 예상 결과 when 조건', () => {
    // Given (준비)
    const input = createTestData();
    
    // When (실행)
    const result = executeFunction(input);
    
    // Then (검증)
    expect(result).toBe(expectedValue);
  });
});
```

### 테스트 파일 구조
- 단위 테스트: `*.test.ts`
- 컴포넌트 테스트: `*.test.tsx`
- E2E 테스트: `*.spec.ts` (e2e 폴더)

## 🎭 모킹 가이드라인

### 서비스 모킹
```typescript
// ✅ 서비스 모킹 예시
vi.mock('../services/api.service', () => ({
  TodoApiService: {
    create: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));
```

### 컴포넌트 모킹
```typescript
// ✅ 컴포넌트 모킹 예시
vi.mock('./complex-component', () => ({
  ComplexComponent: ({ onAction }: { onAction: () => void }) => (
    <button onClick={onAction}>Mocked Component</button>
  )
}));
```

## 📊 테스트 커버리지
- **목표**: 90% 테스트 커버리지
- **우선순위**: 비즈니스 로직 > UI 로직 > 유틸리티
- **제외 대상**: 타입 정의, 설정 파일, 외부 라이브러리

## 🚀 성능 테스트
- 큰 데이터셋에 대한 렌더링 성능 테스트
- 메모리 누수 방지 테스트
- 비동기 작업 타임아웃 테스트

## 🔍 디버깅
- 테스트 실패 시 명확한 에러 메시지 제공
- 디버그 정보를 위한 `screen.debug()` 활용
- 테스트 환경에서만 추가 로깅 구현