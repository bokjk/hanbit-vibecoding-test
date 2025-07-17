### TODO 앱 개발 작업 체크리스트 (Shadcn/ui 적용)

#### Phase 1: Frontend-Only MVP

-   [ ] **1. 프로젝트 초기 설정**
    -   [ ] Vite를 이용한 React + TypeScript 프로젝트 생성
    -   [ ] Tailwind CSS, ESLint, Prettier 설정
    -   [ ] **`Shadcn/ui` 초기화 (`npx shadcn-ui@latest init`)**
    -   [ ] Jest, React Testing Library 테스트 환경 설정
    -   [ ] `design.md`에 명시된 폴더 구조 생성 (`components`, `hooks`, `contexts` 등)
    -   [ ] **(커밋: `feat: initial project setup with shadcn/ui`)**

-   [ ] **2. 핵심 로직 (TDD)**
    -   [ ] **Types & Interfaces 정의**
        -   [ ] `types/todo.ts` 파일에 `Todo`, `Priority`, `TodoFilter` 등 핵심 타입 정의
        -   [ ] **(커밋: `feat: define core data types`)**
    -   [ ] **LocalStorage 서비스 (TDD)**
        -   [ ] `services/localStorage.service.test.ts` 테스트 파일 작성 (CRUD)
        -   [ ] 테스트를 통과하는 `LocalStorageService` 클래스 구현
        -   [ ] **(커밋: `feat(service): implement localStorage service with TDD`)**
    -   [ ] **상태 관리 로직 (TDD)**
        -   [ ] `contexts/todo.reducer.test.ts` 테스트 파일 작성 (add, toggle, delete 등)
        -   [ ] 테스트를 통과하는 `todoReducer` 구현
        -   [ ] `TodoContext` 및 `TodoProvider` 설정
        -   [ ] **(커밋: `feat(state): implement todo state management with reducer and context`)**

-   [ ] **3. UI 컴포넌트 개발 (with Shadcn/ui)**
    -   [ ] **Shadcn/ui 컴포넌트 추가**
        -   [ ] 필요한 컴포넌트 추가 (`npx shadcn-ui@latest add button input ...`)
    -   [ ] **Todo 아이템 컴포넌트**
        -   [ ] `Card`, `Checkbox`, `Button` 등을 조합하여 `TodoItem` 컴포넌트 구현
        -   [ ] **(커밋: `feat(components): implement TodoItem using shadcn/ui`)**
    -   [ ] **Todo 목록 및 제어 컴포넌트**
        -   [ ] `TodoList` 컴포넌트 구현
        -   [ ] `Input`, `Select`, `Button`을 조합하여 `TodoInput` 컴포넌트 구현
        -   [ ] `RadioGroup` 또는 `Button` 그룹으로 `TodoFilters` 컴포넌트 구현
        -   [ ] `TodoStats` 컴포넌트 구현
        -   [ ] **(커밋: `feat(components): implement todo list and controls using shadcn/ui`)**

-   [ ] **4. 컴포넌트 통합 및 기능 구현**
    -   [ ] `TodoContainer`에서 모든 컴포넌트 조립
    -   [ ] `TodoProvider`를 사용해 상태와 액션 연동
    -   [ ] 할 일 추가, 수정, 삭제, 필터링 기능 통합 테스트 작성
    -   [ ] **(커밋: `feat: integrate components and implement core features`)**

-   [ ] **5. 스타일링 및 최종 마무리**
    -   [ ] `Shadcn/ui` 테마를 활용하여 전체 디자인 일관성 확보
    -   [ ] 반응형 레이아웃 최종 점검
    -   [ ] **(커밋: `style: apply final design theme and responsive styles`)**
    -   [ ] **(v1.0 태그 생성)**

---

#### Phase 2: Backend Integration

-   [ ] **1. API 연동 준비**
    -   [ ] `TodoRepository` 인터페이스 정의 (LocalStorage/API 의존성 분리)
    -   [ ] `APIRepository` 클래스 초기 구현 (Mocking)
    -   [ ] **(커밋: `refactor: introduce repository pattern for data layer`)**

-   [ ] **2. 인증 기능 (TDD)**
    -   [ ] `AuthContext` 및 인증 관련 `useAuth` 훅 테스트 작성
    -   [ ] 테스트를 통과하는 인증 로직 구현 (JWT 토큰 처리 포함)
    -   [ ] `Header`에 `UserInfo` 컴포넌트 추가 및 인증 상태 연동
    -   [ ] **(커밋: `feat(auth): implement frontend authentication context and logic`)**

-   [ ] **3. 백엔드 API 연동**
    -   [ ] `APIRepository`에 실제 `fetch` 로직 구현
    -   [ ] 기존 `LocalStorageService`를 `APIRepository`로 교체
    -   [ ] API 호출에 따른 로딩 및 에러 상태 처리 UI 구현
    -   [ ] **(커밋: `feat: integrate with backend API and handle async states`)**

-   [ ] **4. 백엔드 개발 (별도 트랙으로 진행 가능)**
    -   [ ] AWS Lambda, API Gateway, DynamoDB 리소스 프로비저닝 (IaC 권장)
    -   [ ] Todo CRUD 및 인증용 Lambda 함수 개발
    -   [ ] **(커밋: `feat(backend): implement serverless API for todos and auth`)**

-   [ ] **5. 배포**
    -   [ ] 프론트엔드 AWS S3/CloudFront 배포 설정
    -   [ ] GitHub Actions 등을 이용한 CI/CD 파이프라인 구축
    -   [ ] **(커밋: `chore: configure CI/CD pipeline for deployment`)**
    -   [ ] **(v2.0 태그 생성)**