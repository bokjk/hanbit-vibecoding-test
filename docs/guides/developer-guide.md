# 한빛 TODO 앱 개발자 가이드

## 📖 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [프로젝트 구조](#프로젝트-구조)
3. [기술 스택](#기술-스택)
4. [개발 워크플로우](#개발-워크플로우)
5. [코딩 컨벤션](#코딩-컨벤션)
6. [테스트 가이드](#테스트-가이드)
7. [API 개발](#api-개발)
8. [프론트엔드 개발](#프론트엔드-개발)
9. [배포 가이드](#배포-가이드)
10. [기여 가이드라인](#기여-가이드라인)
11. [문제 해결](#문제-해결)

---

## 개발 환경 설정

### 🛠️ 필수 도구

**Node.js 환경:**

```bash
# Node.js 18+ 설치 (권장: 18.17.0+)
node --version  # v18.17.0+
npm --version   # 9.0.0+

# pnpm 설치 (패키지 매니저)
npm install -g pnpm
pnpm --version  # 8.0.0+
```

**개발 도구:**

- **IDE**: VSCode (권장), WebStorm, Vim
- **Git**: 2.30+ 버전
- **AWS CLI**: 2.0+ (배포용)
- **Docker**: 20.0+ (로컬 서버 테스트용)

### 🚀 프로젝트 설정

```bash
# 1. 저장소 클론
git clone https://github.com/hanbit/todo-app.git
cd todo-app

# 2. 의존성 설치 (루트에서 실행)
pnpm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 편집하여 필요한 값 설정

# 4. 개발 서버 시작
pnpm dev

# 5. 타입 체크
pnpm type-check

# 6. 린트 체크
pnpm lint

# 7. 테스트 실행
pnpm test
```

### 📁 VSCode 확장 프로그램 (권장)

```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "ms-playwright.playwright",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-json"
  ]
}
```

---

## 프로젝트 구조

### 🏗️ 모노레포 구조

```
hanbit-todo-app/
├── apps/
│   ├── client/                 # React 프론트엔드
│   │   ├── src/
│   │   │   ├── components/     # React 컴포넌트
│   │   │   ├── contexts/       # React Context
│   │   │   ├── hooks/          # 커스텀 훅
│   │   │   ├── services/       # API 서비스
│   │   │   ├── types/          # 타입 정의
│   │   │   └── utils/          # 유틸리티
│   │   ├── public/             # 정적 파일
│   │   └── package.json
│   └── server/                 # Node.js 백엔드 (미래)
├── packages/
│   ├── types/                  # 공유 타입
│   └── ui/                     # 공유 UI 컴포넌트
├── docs/                       # 문서
├── .claude/                    # Claude 설정
└── package.json               # 루트 패키지 설정
```

### 📦 패키지 의존성

```json
// 워크스페이스 의존성 관리
{
  "dependencies": {
    "@hanbit/types": "workspace:*",
    "@hanbit/ui": "workspace:*"
  }
}
```

---

## 기술 스택

### 🎨 프론트엔드

**핵심 라이브러리:**

- **React 18**: 함수형 컴포넌트, Hooks
- **TypeScript**: 완전한 타입 안전성
- **Vite**: 빠른 빌드 및 개발 서버
- **Tailwind CSS**: 유틸리티 우선 CSS

**상태 관리:**

- **React Context + useReducer**: 전역 상태 관리
- **커스텀 훅**: 비즈니스 로직 분리

**UI 컴포넌트:**

- **shadcn/ui**: 접근 가능한 컴포넌트 라이브러리
- **Radix UI**: 하위 수준 UI 프리미티브

**테스트:**

- **Vitest**: 단위 테스트
- **React Testing Library**: 컴포넌트 테스트
- **Playwright**: E2E 테스트

### 🔧 개발 도구

**코드 품질:**

- **ESLint**: 정적 분석
- **Prettier**: 코드 포맷팅
- **Husky**: Git 훅
- **lint-staged**: 스테ージ된 파일 린트

**타입 체크:**

- **TypeScript**: strict 모드
- **타입 가드**: 런타임 타입 검사

---

## 개발 워크플로우

### 🔄 브랜치 전략

```bash
main                    # 프로덕션 브랜치
├── develop            # 개발 브랜치
├── feature/todo-crud  # 기능 브랜치
├── bugfix/fix-login   # 버그 수정 브랜치
└── hotfix/urgent-fix  # 핫픽스 브랜치
```

### 📝 커밋 컨벤션

**Conventional Commits 사용:**

```bash
# 새 기능
feat: 할일 우선순위 설정 기능 추가

# 버그 수정
fix: 할일 삭제 시 상태 업데이트 오류 수정

# 문서 업데이트
docs: API 문서에 인증 방법 추가

# 스타일 변경
style: 할일 목록 카드 디자인 개선

# 리팩토링
refactor: TodoService 클래스 구조 개선

# 테스트 추가
test: TodoItem 컴포넌트 테스트 케이스 추가

# 빌드/설정 변경
chore: ESLint 규칙 업데이트
```

### 🔍 코드 리뷰 프로세스

1. **PR 생성**: 기능 완료 후 Pull Request 생성
2. **자동 검사**: CI/CD에서 자동 테스트 및 린트
3. **코드 리뷰**: 최소 1명의 승인 필요
4. **테스트 확인**: 모든 테스트 통과 확인
5. **병합**: Squash merge 사용

---

## 코딩 컨벤션

### 📋 일반 규칙

**파일 명명:**

```
components/todo-item.tsx        # kebab-case
hooks/use-todo-service.ts       # kebab-case
utils/date-formatter.ts         # kebab-case
types/api.types.ts              # kebab-case
```

**변수/함수 명명:**

```typescript
// camelCase 사용
const todoItems = [];
const handleTodoClick = () => {};

// 컴포넌트는 PascalCase
const TodoItem = () => {};

// 상수는 UPPER_SNAKE_CASE
const MAX_TODO_COUNT = 100;
```

### 🎯 TypeScript 규칙

**타입 정의:**

```typescript
// 인터페이스 사용 (확장 가능한 객체)
interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

// 타입 사용 (유니온/교집합)
type Priority = "low" | "medium" | "high";
type TodoWithPriority = TodoItem & { priority: Priority };

// 제네릭 사용
interface APIResponse<T> {
  success: boolean;
  data: T;
}
```

**함수 시그니처:**

```typescript
// 명시적 타입 정의
function createTodo(title: string, priority: Priority): TodoItem {
  // 구현
}

// 비동기 함수
async function fetchTodos(): Promise<TodoItem[]> {
  // 구현
}
```

### ⚛️ React 컨벤션

**컴포넌트 구조:**

```typescript
interface Props {
  /** JSDoc으로 props 설명 */
  title: string;
  onComplete?: (id: string) => void;
}

export function TodoItem({ title, onComplete }: Props) {
  // 1. 상태 및 훅
  const [isEditing, setIsEditing] = useState(false);

  // 2. 이벤트 핸들러
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  // 3. 렌더링
  return (
    <div className="todo-item">
      {/* JSX */}
    </div>
  );
}
```

**커스텀 훅:**

```typescript
export function useTodoService() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const addTodo = useCallback(async (title: string) => {
    setLoading(true);
    try {
      // API 호출
    } finally {
      setLoading(false);
    }
  }, []);

  return { todos, loading, addTodo };
}
```

### 🎨 Tailwind CSS 규칙

**클래스 순서:**

```typescript
// 레이아웃 → 박스 모델 → 타이포그래피 → 색상 → 효과
<div className="
  flex items-center justify-between
  w-full h-12 p-4 m-2
  text-lg font-medium
  bg-white text-gray-900
  rounded-lg shadow-sm hover:shadow-md
  transition-shadow duration-200
">
```

**반응형 디자인:**

```typescript
<div className="
  w-full
  md:w-1/2
  lg:w-1/3
  xl:w-1/4
">
```

---

## 테스트 가이드

### 🧪 테스트 전략

**테스트 피라미드:**

```
E2E 테스트 (Playwright)     ← 적게
통합 테스트 (React Testing Library) ← 보통
단위 테스트 (Vitest)       ← 많이
```

### 🔬 단위 테스트

**Vitest 사용:**

```typescript
// src/__tests__/utils/date-formatter.test.ts
import { describe, it, expect } from "vitest";
import { formatDate } from "../utils/date-formatter";

describe("formatDate", () => {
  it("should format date correctly", () => {
    // Given
    const date = new Date("2024-01-15T10:30:00Z");

    // When
    const result = formatDate(date);

    // Then
    expect(result).toBe("2024.01.15");
  });
});
```

### 🖼️ 컴포넌트 테스트

**React Testing Library 사용:**

```typescript
// src/__tests__/components/todo-item.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TodoItem } from '../components/todo-item';

describe('TodoItem', () => {
  it('should toggle completion when clicked', () => {
    // Given
    const todo = { id: '1', title: 'Test', completed: false };
    const onToggle = vi.fn();
    render(<TodoItem todo={todo} onToggle={onToggle} />);

    // When
    fireEvent.click(screen.getByRole('checkbox'));

    // Then
    expect(onToggle).toHaveBeenCalledWith('1');
  });
});
```

### 🌐 E2E 테스트

**Playwright 사용:**

```typescript
// e2e/todo-crud.spec.ts
import { test, expect } from "@playwright/test";

test("should create and complete todo", async ({ page }) => {
  // Given
  await page.goto("/");

  // When - 새 할일 추가
  await page.fill('[data-testid="todo-input"]', "New Todo");
  await page.press('[data-testid="todo-input"]', "Enter");

  // Then - 할일이 추가됨
  await expect(page.locator("text=New Todo")).toBeVisible();

  // When - 할일 완료 처리
  await page.click('[data-testid="todo-checkbox"]:first-child');

  // Then - 완료 표시됨
  await expect(page.locator(".completed")).toBeVisible();
});
```

### 📊 테스트 실행

```bash
# 모든 테스트 실행
pnpm test

# 단위 테스트만 실행
pnpm test:unit

# E2E 테스트 실행
pnpm test:e2e

# 테스트 커버리지 확인
pnpm test:coverage

# 테스트 감시 모드
pnpm test:watch
```

---

## API 개발

### 🔌 API 클라이언트

**서비스 레이어 패턴:**

```typescript
// src/services/api/todo-api-client.ts
export class TodoApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async getTodos(): Promise<TodoItem[]> {
    const response = await fetch(`${this.baseURL}/todos`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new APIError(`Failed to fetch todos: ${response.status}`);
    }

    const data = await response.json();
    return data.todos;
  }
}
```

**에러 처리:**

```typescript
// src/errors/api-error.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "APIError";
  }

  isNetworkError(): boolean {
    return !this.status || this.status >= 500;
  }
}
```

### 🔄 상태 관리

**Context + Reducer 패턴:**

```typescript
// src/contexts/todo.context.tsx
interface TodoState {
  items: TodoItem[];
  loading: boolean;
  error: string | null;
}

type TodoAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; payload: TodoItem[] }
  | { type: "LOAD_ERROR"; payload: string }
  | { type: "ADD_TODO"; payload: TodoItem };

function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, items: action.payload };
    default:
      return state;
  }
}
```

---

## 프론트엔드 개발

### 🎨 컴포넌트 개발

**Compound Components 패턴:**

```typescript
// src/components/todo-list/index.tsx
export const TodoList = {
  Root: TodoListRoot,
  Header: TodoListHeader,
  Item: TodoListItem,
  Footer: TodoListFooter,
};

// 사용법
<TodoList.Root>
  <TodoList.Header title="My Todos" />
  {todos.map(todo => (
    <TodoList.Item key={todo.id} todo={todo} />
  ))}
  <TodoList.Footer count={todos.length} />
</TodoList.Root>
```

**Render Props 패턴:**

```typescript
// src/components/todo-provider.tsx
interface TodoProviderProps {
  children: (props: {
    todos: TodoItem[];
    addTodo: (title: string) => void;
    loading: boolean;
  }) => React.ReactNode;
}

export function TodoProvider({ children }: TodoProviderProps) {
  const { todos, addTodo, loading } = useTodoService();

  return children({ todos, addTodo, loading });
}
```

### 🪝 커스텀 훅 개발

**데이터 페칭 훅:**

```typescript
// src/hooks/use-todos.ts
export function useTodos() {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  const loadTodos = useCallback(async () => {
    dispatch({ type: "LOAD_START" });
    try {
      const todos = await todoApiClient.getTodos();
      dispatch({ type: "LOAD_SUCCESS", payload: todos });
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", payload: error.message });
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  return { ...state, loadTodos };
}
```

### 📱 반응형 디자인

**모바일 우선 접근법:**

```typescript
// 브레이크포인트 유틸리티
const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

// 미디어 쿼리 훅
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addListener(listener);

    return () => media.removeListener(listener);
  }, [query]);

  return matches;
}
```

---

## 배포 가이드

### 🚀 배포 전 체크리스트

```bash
# 1. 타입 체크
pnpm type-check

# 2. 린트 체크
pnpm lint

# 3. 테스트 실행
pnpm test

# 4. 빌드 테스트
pnpm build

# 5. E2E 테스트
pnpm test:e2e
```

### 📦 프로덕션 빌드

```bash
# 프로덕션 빌드
pnpm build

# 빌드 결과 미리보기
pnpm preview

# 빌드 분석
pnpm build:analyze
```

### 🌐 환경 변수

```bash
# .env.local (개발 환경)
VITE_API_BASE_URL=http://localhost:3001
VITE_AUTH_DOMAIN=dev-auth.example.com

# .env.production (프로덕션 환경)
VITE_API_BASE_URL=https://api.todo-app.com
VITE_AUTH_DOMAIN=auth.todo-app.com
```

---

## 기여 가이드라인

### 🤝 기여 방법

1. **이슈 생성**: 버그 리포트 또는 기능 요청
2. **Fork & Clone**: 개인 저장소로 Fork 후 클론
3. **브랜치 생성**: 기능별 브랜치 생성
4. **개발**: 코딩 컨벤션 준수하여 개발
5. **테스트**: 모든 테스트 통과 확인
6. **PR 생성**: 상세한 설명과 함께 Pull Request 생성

### 📝 PR 템플릿

```markdown
## 변경 사항

- [ ] 새 기능 추가
- [ ] 버그 수정
- [ ] 문서 업데이트
- [ ] 리팩토링
- [ ] 테스트 추가

## 설명

이 PR은 ...

## 테스트

- [ ] 단위 테스트 추가/수정
- [ ] E2E 테스트 확인
- [ ] 수동 테스트 완료

## 스크린샷 (UI 변경의 경우)

Before: [스크린샷]
After: [스크린샷]

## 추가 정보

- 관련 이슈: #123
- 영향받는 컴포넌트: TodoItem, TodoList
```

### 🔍 코드 리뷰 가이드라인

**리뷰어 체크리스트:**

- [ ] 코딩 컨벤션 준수
- [ ] 타입 안전성 확인
- [ ] 테스트 커버리지 적절
- [ ] 성능 이슈 없음
- [ ] 접근성 고려
- [ ] 보안 이슈 없음

---

## 문제 해결

### 🐛 일반적인 문제

**타입 에러 해결:**

```bash
# 타입 캐시 정리
pnpm type-check --clean

# node_modules 재설치
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**빌드 오류 해결:**

```bash
# Vite 캐시 정리
rm -rf node_modules/.vite
pnpm dev

# 전체 캐시 정리
pnpm clean
pnpm install
pnpm build
```

**테스트 실패 해결:**

```bash
# 테스트 캐시 정리
pnpm test --clearCache

# 특정 테스트만 실행
pnpm test todo-item.test.tsx

# 디버그 모드로 실행
pnpm test --reporter=verbose
```

### 🔧 개발 도구 문제

**VSCode 설정:**

```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

**ESLint 캐시 문제:**

```bash
# ESLint 캐시 정리
rm -rf .eslintcache
pnpm lint

# 특정 파일만 린트
pnpm lint src/components/todo-item.tsx
```

### 📞 도움 요청

**내부 문의:**

- 🔧 기술 문제: #dev-help 슬랙 채널
- 📋 기능 요청: GitHub Issues
- 🐛 버그 리포트: GitHub Issues

**외부 리소스:**

- [React 공식 문서](https://react.dev/)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [Vite 가이드](https://vitejs.dev/guide/)

---

## 📚 추가 자료

### 🔗 유용한 링크

- [프로젝트 설계 문서](../design.md)
- [API 문서](../api/openapi.yaml)
- [사용자 가이드](user-guide.md)
- [운영 매뉴얼](operations-manual.md)

### 📖 권장 학습 자료

**React & TypeScript:**

- React 공식 베타 문서
- TypeScript Deep Dive
- React Testing Library 가이드

**CSS & 디자인:**

- Tailwind CSS 플레이그라운드
- CSS Grid Garden
- Flexbox Froggy

---

_이 문서는 프로젝트 발전에 따라 지속적으로 업데이트됩니다._

**마지막 업데이트**: 2024년 1월 15일  
**버전**: 1.0.0
