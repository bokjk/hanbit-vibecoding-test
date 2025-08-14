# 3. 데이터 모델 설계

## 3.1 Todo 엔티티

```typescript
interface Todo {
  id: string; // UUID
  title: string; // 할 일 제목 (필수)
  description?: string; // 할 일 설명 (선택사항)
  completed: boolean; // 완료 상태
  priority: Priority; // 우선순위
  createdAt: string; // ISO 8601 형식
  updatedAt: string; // ISO 8601 형식

  // 2단계: 인증 관련 필드
  userId: string; // Cognito User ID 또는 게스트 세션 ID
  isGuest: boolean; // 게스트 사용자 여부
  sessionId?: string; // 게스트 세션 ID
}

type Priority = "high" | "medium" | "low";
```

## 3.2 필터 및 정렬 타입

```typescript
enum FilterType {
  ALL = "all",
  ACTIVE = "active",
  COMPLETED = "completed",
}

enum SortBy {
  CREATED_DATE = "createdDate",
  PRIORITY = "priority",
  TITLE = "title",
}

interface TodoFilter {
  type: FilterType;
  sortBy: SortBy;
  sortOrder: "asc" | "desc";
}
```

## 3.3 사용자 및 인증 모델 (2단계)

```typescript
interface User {
  id: string; // Cognito User ID
  email?: string; // 인증된 사용자만 보유
  isGuest: boolean; // 게스트 여부
  createdAt: string; // ISO 8601 형식
  lastLoginAt: string; // 마지막 로그인 시간
  settings: UserSettings; // 사용자 설정
}

interface UserSettings {
  theme: "light" | "dark"; // 테마 설정
  defaultPriority: Priority; // 기본 우선순위
  autoSort: boolean; // 자동 정렬 여부
}

// 권한 시스템
interface GuestPermissions {
  canRead: boolean; // true - 샘플 데이터 읽기
  canCreate: boolean; // true - 임시 TODO 생성 (세션 기반)
  canUpdate: boolean; // true - 세션 내 수정
  canDelete: boolean; // true - 세션 내 삭제
  persistData: boolean; // false - 영구 저장 불가
  maxItems: number; // 10 - 최대 항목 수 제한
}

interface AuthenticatedPermissions {
  canRead: boolean; // true - 본인 데이터 읽기
  canCreate: boolean; // true - 무제한 생성
  canUpdate: boolean; // true - 본인 데이터 수정
  canDelete: boolean; // true - 본인 데이터 삭제
  persistData: boolean; // true - 영구 저장
  maxItems: number; // 1000 - 최대 항목 수
}

// 인증 상태
interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  permissions: GuestPermissions | AuthenticatedPermissions;
  cognitoCredentials: any; // AWS Cognito credentials
}
```

## 3.4 애플리케이션 상태

```typescript
interface AppState {
  todos: Todo[];
  filter: TodoFilter;
  loading: boolean;
  error: string | null;

  // 2단계: 인증 상태 추가
  auth: AuthState;

  // 동기화 상태 (2단계)
  sync: {
    isOnline: boolean;
    lastSyncAt: string | null;
    pendingActions: PendingAction[];
  };
}

interface PendingAction {
  id: string;
  type: "create" | "update" | "delete";
  payload: any;
  timestamp: string;
  retryCount: number;
}
```

**이전**: [시스템 아키텍처](02-architecture.md)  
**다음**: [컴포넌트 설계](04-components.md)
