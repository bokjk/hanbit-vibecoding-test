# TODO 앱 모노레포 개발 가이드 - Cursor Rules

## 프로젝트 개요
React + TypeScript 기반의 TODO 관리 웹 애플리케이션을 pnpm workspace로 관리하는 모노레포 프로젝트입니다.

## 아키텍처 구조
```
dev/ (root)
├── apps/
│   ├── client/             # React 프론트엔드 (Vite)
│   └── server/             # 백엔드 (AWS Lambda)
├── packages/
│   ├── ui/                 # 공유 UI 컴포넌트 (Shadcn/ui)
│   └── types/              # 공유 TypeScript 타입
└── docs/                   # 문서 및 설계
```

## 기술 스택
- **모노레포 관리**: pnpm workspaces
- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS
- **UI Kit**: Shadcn/ui
- **상태 관리**: React Context + useReducer
- **테스트**: Vitest + React Testing Library
- **백엔드**: Node.js + TypeScript (AWS Lambda)
- **인프라**: AWS 서버리스 (API Gateway, Lambda, DynamoDB)

## 개발 원칙

### 0. 의사소통 규칙
- **모든 응답은 한국어로** 제공
- **기술적 결정에 대한 명확한 설명** 제공
- **변수/함수명은 영어로** 작성 (가독성을 위해)
- **커밋 메시지는 한국어로** 작성 (Conventional Commits 준수)

### 1. 프로젝트 구조 및 명명 규칙
- **파일명**: kebab-case (예: `todo-item.tsx`)
- **컴포넌트명**: PascalCase (예: `TodoItem`)
- **함수명**: camelCase (예: `addTodo`)
- **상수명**: UPPER_SNAKE_CASE (예: `TODOS_KEY`)
- **패키지 참조**: workspace:* 형태로 관리

### 2. TypeScript 엄격 규칙
- `strict: true` 설정 필수
- `any` 타입 금지, `unknown` 사용 권장
- 모든 함수의 입력/출력 타입 명시
- 고급 TypeScript 기능 활용 (type guards, mapped types, conditional types)
- interface vs type 구분:
  - interface: 확장 가능한 객체 타입
  - type: union, intersection, primitive 조합

### 3. React 개발 규칙
- **함수형 컴포넌트** 사용 필수
- **Custom Hooks** 패턴으로 비즈니스 로직 분리
- **Props 검증** 및 기본값 설정
- **React.memo** 적절한 사용으로 성능 최적화
- **useCallback**, **useMemo** 의존성 배열 정확히 관리

### 4. 상태 관리 패턴
```typescript
// Context + Reducer 패턴 사용
interface TodoContextType {
  state: AppState;
  dispatch: React.Dispatch<TodoAction>;
  // 편의 메서드들
  addTodo: (title: string, priority: Priority) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
}
```

### 5. Tailwind CSS + Shadcn/ui 규칙
- **Utility-first** 접근법 준수
- 커스텀 CSS 최소화, Tailwind 클래스 우선 사용
- **응답형 디자인** 모바일 우선 (mobile-first)
- Shadcn/ui 컴포넌트 적극 활용:
  ```typescript
  import { Button } from "@/components/ui/button"
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
  ```
- CSS 변수를 통한 일관된 디자인 토큰 사용

## 공유 패키지 사용법

### Types 패키지
```typescript
import { Todo, Priority, FilterType } from 'types'

// 핵심 타입들
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}
```

### UI 패키지
```typescript
import { Button, cn } from 'ui'

// cn 유틸리티로 클래스 병합
<Button className={cn("base-class", conditionalClass && "additional-class")} />
```

## TDD 개발 프로세스

### 1. 백엔드 개발 (필수 TDD) 🚨
```typescript
// RED: 실패하는 테스트 먼저 작성
describe('LocalStorageService', () => {
  it('새로운 todo를 추가하고 반환해야 함', async () => {
    // Given (준비)
    const service = new LocalStorageService();
    const request = { title: '테스트 할 일', priority: Priority.HIGH };
    
    // When (실행)
    const result = await service.addTodo(request);
    
    // Then (검증)
    expect(result.id).toBeDefined();
    expect(result.title).toBe(request.title);
    expect(result.completed).toBe(false);
  });
});

// GREEN: 테스트를 통과하는 최소 코드 작성
// REFACTOR: 코드 개선 (테스트는 유지)
```

**⚠️ 중요**: 백엔드 핵심 로직은 반드시 TDD로 개발해야 함

### 2. 프론트엔드 UI (구현 우선)
- **실행 가능한 UI 먼저 구현**: 사용자가 즉시 확인 가능
- **이후 테스트 추가**: 안정성 및 회귀 방지
- **사용자 상호작용 중심**: React Testing Library 활용

## 코드 품질 및 컨벤션

### 1. 컴포넌트 설계 원칙
- **단일 책임 원칙**: 한 컴포넌트는 하나의 역할만
- **Props 최소화**: 필요한 props만 전달
- **재사용성**: 도메인 독립적인 컴포넌트 설계
- **접근성**: ARIA 속성, 키보드 네비게이션 고려

### 2. 성능 최적화
- **Code Splitting**: 필요시 React.lazy 사용
- **Optimistic Updates**: 즉각적인 UI 반영
- **Virtual Scrolling**: 대량 데이터 처리시
- **Image Optimization**: 적절한 포맷 및 크기 사용

### 3. 에러 처리
```typescript
// Error Boundary 패턴
class TodoErrorBoundary extends React.Component {
  // 에러 상태 관리 및 fallback UI 제공
}

// 서비스 레벨 에러 처리
try {
  const todos = await todoService.getTodos();
} catch (error) {
  console.error('Failed to fetch todos:', error);
  // 사용자에게 친화적인 에러 메시지 표시
}
```

## 데이터 플로우 패턴

### 1단계: localStorage 기반
```typescript
User Interaction → Component → Context → Reducer → LocalStorage Service
```

### 2단계: API 연동
```typescript
User Interaction → Component → Context → Reducer → API Service → Backend
```

## 테스트 전략

### 1. 테스트 피라미드
- **Unit Tests**: 90% 커버리지 목표
- **Integration Tests**: 컴포넌트 간 상호작용
- **E2E Tests**: 핵심 사용자 시나리오

### 2. 테스트 도구
- **Vitest**: 단위 테스트 프레임워크
- **React Testing Library**: 컴포넌트 테스트
- **MSW**: API 모킹
- **@testing-library/user-event**: 사용자 상호작용 시뮬레이션

## Git 워크플로우

### 1. 커밋 컨벤션
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드 설정 등
```

### 2. 브랜치 전략
- `main`: 프로덕션 코드
- `feature/*`: 기능 개발
- `fix/*`: 버그 수정

## 배포 및 인프라

### 1단계: GitHub Pages
- 정적 사이트 배포
- GitHub Actions CI/CD

### 2단계: AWS 서버리스
- AWS CDK로 인프라 관리
- API Gateway + Lambda + DynamoDB

## 접근성 및 사용성

### 1. 접근성 기준
- **WCAG 2.1 AA** 준수
- **키보드 네비게이션** 지원
- **스크린 리더** 호환성
- **적절한 색상 대비** 유지

### 2. 반응형 디자인
- **모바일 우선** 설계
- **Tailwind 브레이크포인트** 활용:
  ```css
  /* Mobile First */
  .container {
    @apply px-4;
  }
  
  /* Tablet */
  @screen md {
    @apply px-6 max-w-2xl mx-auto;
  }
  
  /* Desktop */
  @screen lg {
    @apply px-8 max-w-4xl;
  }
  ```

## 개발 환경 설정

### 필수 도구
- **Node.js 18+**
- **pnpm**: 패키지 매니저
- **VSCode**: 권장 에디터 + 확장프로그램
  - TypeScript
  - Tailwind CSS IntelliSense
  - ES7+ React/Redux/React-Native snippets

### 환경변수 관리
```typescript
// .env.local (1단계)
VITE_APP_VERSION=1.0.0

// .env.local (2단계)
VITE_API_URL=https://api.example.com
```

## 보안 고려사항

### 1단계: 클라이언트 보안
- **XSS 방지**: 입력값 검증 및 sanitization
- **CSP 설정**: Content Security Policy
- **HTTPS 강제**: 프로덕션 환경

### 2단계: 전체 보안
- **JWT 토큰** 기반 인증
- **API Rate Limiting**
- **CORS 설정**
- **데이터 검증**: 클라이언트/서버 양쪽

## 문서화 규칙

### 1. 코드 문서화
```typescript
/**
 * Todo 항목을 생성합니다.
 * @param title - Todo 제목 (필수)
 * @param priority - 우선순위 (기본값: MEDIUM)
 * @returns 생성된 Todo 객체
 */
export async function createTodo(
  title: string, 
  priority: Priority = Priority.MEDIUM
): Promise<Todo> {
  // 구현
}
```

### 2. 컴포넌트 문서화
```typescript
interface TodoItemProps {
  /** Todo 데이터 객체 */
  todo: Todo;
  /** 완료 상태 토글 핸들러 */
  onToggle: (id: string) => void;
  /** 삭제 핸들러 */
  onDelete: (id: string) => void;
}
```

## 개발 워크플로우

### 단계별 진행 절차
1. **시작 전**: requirements.md와 design.md 숙지 필수
2. **백엔드 기능**: TDD 방식 (테스트 → 구현 → 리팩토링)
3. **프론트엔드 기능**: 실행 가능한 UI 먼저, 이후 테스트 추가
4. **문서화**: 작업 완료 후 checklist.md 업데이트 필수
5. **커밋**: Conventional Commits 형식으로 한국어 메시지
6. **리뷰**: PR을 통한 코드 리뷰 진행

## 🚨 절대 금지 사항

- **❌ 요구사항 미확인 구현**: requirements.md 확인 없이 개발 금지
- **❌ 백엔드 테스트 없는 코드**: TDD 없는 백엔드 로직 금지
- **❌ 체크리스트 미업데이트**: 작업 완료 후 checklist.md 업데이트 필수
- **❌ 불필요한 커스텀 CSS**: Tailwind로 해결 가능한 경우 커스텀 CSS 금지
- **❌ any 타입 사용**: TypeScript의 any 타입 사용 금지
- **❌ 영어 응답**: 모든 커뮤니케이션은 한국어로만

## 최종 체크리스트

개발 완료 전 반드시 확인:
- [ ] **요구사항 문서 확인** (requirements.md, design.md)
- [ ] **TypeScript 컴파일 에러 없음**
- [ ] **ESLint 규칙 준수**
- [ ] **테스트 통과** (단위/통합)
- [ ] **TDD 규칙 준수** (백엔드)
- [ ] **접근성 기준 충족** (WCAG 2.1 AA)
- [ ] **모바일 반응성 확인**
- [ ] **성능 최적화 적용**
- [ ] **체크리스트 업데이트** (docs/checklist.md)
- [ ] **문서 동기화** (필요시 설계 문서 업데이트)
- [ ] **Git 커밋 메시지 규칙 준수** (한국어 + Conventional Commits)

---

이 규칙들을 엄격히 따라 일관되고 확장 가능한 TODO 애플리케이션을 개발하세요. 