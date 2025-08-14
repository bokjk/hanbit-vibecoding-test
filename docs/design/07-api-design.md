# 7. API 설계 (2단계)

## 7.1 REST API 엔드포인트 명세

### 7.1.1 TODO CRUD API

```typescript
// Base URL: https://api.todo-app.com/api/v1

// 1. 할 일 목록 조회
GET /todos
Headers: {
  "Authorization": "Bearer <cognito-token>",
  "Content-Type": "application/json"
}
Query Parameters: {
  limit?: number,     // pagination limit (default: 20)
  cursor?: string,    // pagination cursor
  filter?: 'all' | 'active' | 'completed',
  sortBy?: 'createdAt' | 'priority' | 'title',
  sortOrder?: 'asc' | 'desc'
}

Response: {
  "success": true,
  "data": {
    "todos": Todo[],
    "pagination": {
      "hasNextPage": boolean,
      "nextCursor": string | null,
      "totalCount": number
    },
    "metadata": {
      "userLimits": {
        "maxItems": number,
        "currentCount": number,
        "isGuest": boolean
      }
    }
  }
}

// 2. 새 할 일 생성
POST /todos
Headers: {
  "Authorization": "Bearer <cognito-token>",
  "Content-Type": "application/json"
}
Body: {
  "title": string,
  "description"?: string,
  "priority": Priority
}

Response: {
  "success": true,
  "data": {
    "todo": Todo,
    "remainingQuota": number // 게스트 사용자의 경우
  }
}

// 3. 특정 할 일 조회
GET /todos/{todoId}
Headers: {
  "Authorization": "Bearer <cognito-token>"
}

Response: {
  "success": true,
  "data": {
    "todo": Todo
  }
}

// 4. 할 일 수정
PUT /todos/{todoId}
Headers: {
  "Authorization": "Bearer <cognito-token>",
  "Content-Type": "application/json"
}
Body: {
  "title"?: string,
  "description"?: string,
  "priority"?: Priority,
  "completed"?: boolean
}

Response: {
  "success": true,
  "data": {
    "todo": Todo
  }
}

// 5. 할 일 삭제
DELETE /todos/{todoId}
Headers: {
  "Authorization": "Bearer <cognito-token>"
}

Response: {
  "success": true,
  "data": {
    "deletedId": string
  }
}
```

### 7.1.2 인증 관련 API

```typescript
// 1. 게스트 토큰 발급
POST /auth/guest
Headers: {
  "Content-Type": "application/json"
}

Response: {
  "success": true,
  "data": {
    "guestToken": string,        // Cognito Identity Pool 토큰
    "sessionId": string,         // 게스트 세션 ID
    "expiresIn": number,         // 토큰 만료 시간 (초)
    "permissions": GuestPermissions,
    "sampleTodos": Todo[]        // 샘플 할 일 데이터
  }
}

// 2. 토큰 갱신
POST /auth/refresh
Headers: {
  "Authorization": "Bearer <refresh-token>",
  "Content-Type": "application/json"
}

Response: {
  "success": true,
  "data": {
    "accessToken": string,
    "expiresIn": number
  }
}

// 3. 사용자 정보 조회
GET /auth/me
Headers: {
  "Authorization": "Bearer <cognito-token>"
}

Response: {
  "success": true,
  "data": {
    "user": User,
    "permissions": GuestPermissions | AuthenticatedPermissions
  }
}
```

### 7.1.3 데이터 관리 API

```typescript
// 1. 데이터 내보내기
GET /export
Headers: {
  "Authorization": "Bearer <cognito-token>"
}
Query Parameters: {
  format?: 'json' | 'csv'
}

Response: {
  "success": true,
  "data": {
    "exportUrl": string,        // 다운로드 URL (pre-signed)
    "expiresAt": string,        // URL 만료 시간
    "format": string,
    "totalItems": number
  }
}

// 2. 데이터 가져오기
POST /import
Headers: {
  "Authorization": "Bearer <cognito-token>",
  "Content-Type": "multipart/form-data"
}
Body: FormData {
  file: File,                   // JSON/CSV 파일
  options: {
    "mergeStrategy": "replace" | "merge",
    "validateData": boolean
  }
}

Response: {
  "success": true,
  "data": {
    "importedCount": number,
    "skippedCount": number,
    "errors": string[]
  }
}

// 3. localStorage 마이그레이션
POST /migrate
Headers: {
  "Authorization": "Bearer <cognito-token>",
  "Content-Type": "application/json"
}
Body: {
  "localStorageData": Todo[],
  "migrationOptions": {
    "preserveIds": boolean,
    "mergeStrategy": "replace" | "merge"
  }
}

Response: {
  "success": true,
  "data": {
    "migratedCount": number,
    "duplicateCount": number,
    "totalCount": number
  }
}
```

## 7.2 에러 응답 표준화

```typescript
// 에러 응답 형식
interface ErrorResponse {
  success: false;
  error: {
    code: string; // 에러 코드 (VALIDATION_ERROR, UNAUTHORIZED 등)
    message: string; // 사용자 친화적 메시지
    details?: any; // 상세 정보 (개발 환경에서만)
    timestamp: string; // ISO 8601 형식
    requestId: string; // 추적용 요청 ID
  };
}

// 공통 에러 코드
enum ErrorCode {
  // 인증 관련
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // 검증 관련
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",

  // 리소스 관련
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",

  // 서버 관련
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}
```

## 7.3 API 클라이언트 설계

```typescript
class TodoAPIClient {
  private baseURL: string;
  private authService: AuthService;

  constructor(baseURL: string, authService: AuthService) {
    this.baseURL = baseURL;
    this.authService = authService;
  }

  // HTTP 요청 래퍼
  private async request<T>(
    endpoint: string,
    options: RequestInit,
  ): Promise<APIResponse<T>> {
    const token = await this.authService.getValidToken();

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new APIError(errorData);
    }

    return response.json();
  }

  // TODO CRUD 메서드들
  async getTodos(params?: GetTodosParams): Promise<GetTodosResponse> {
    const queryString = params ? new URLSearchParams(params).toString() : "";
    return this.request(`/todos${queryString ? `?${queryString}` : ""}`, {
      method: "GET",
    });
  }

  async createTodo(data: CreateTodoRequest): Promise<CreateTodoResponse> {
    return this.request("/todos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTodo(id: string): Promise<GetTodoResponse> {
    return this.request(`/todos/${id}`, {
      method: "GET",
    });
  }

  async updateTodo(
    id: string,
    data: UpdateTodoRequest,
  ): Promise<UpdateTodoResponse> {
    return this.request(`/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTodo(id: string): Promise<DeleteTodoResponse> {
    return this.request(`/todos/${id}`, {
      method: "DELETE",
    });
  }

  // 인증 관련 메서드들
  async getGuestToken(): Promise<GuestTokenResponse> {
    return this.request("/auth/guest", {
      method: "POST",
    });
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    return this.request("/auth/refresh", {
      method: "POST",
    });
  }

  async getUserInfo(): Promise<UserInfoResponse> {
    return this.request("/auth/me", {
      method: "GET",
    });
  }
}
```

## 7.4 API 서비스 계층

```typescript
export class TodoService {
  private apiClient: TodoAPIClient;
  private syncManager: SyncManager;

  constructor(apiClient: TodoAPIClient, syncManager: SyncManager) {
    this.apiClient = apiClient;
    this.syncManager = syncManager;
  }

  async getAllTodos(params?: GetTodosParams): Promise<Todo[]> {
    try {
      const response = await this.apiClient.getTodos(params);
      return response.data.todos;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 오프라인 모드로 전환
        return this.syncManager.getLocalTodos();
      }
      throw error;
    }
  }

  async createTodo(title: string, priority: Priority): Promise<Todo> {
    const todoData = { title, priority };

    try {
      const response = await this.apiClient.createTodo(todoData);
      return response.data.todo;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 낙관적 업데이트
        const optimisticTodo = this.createOptimisticTodo(title, priority);
        this.syncManager.addPendingAction({
          type: "create",
          payload: todoData,
          optimisticId: optimisticTodo.id,
        });
        return optimisticTodo;
      }
      throw error;
    }
  }

  private createOptimisticTodo(title: string, priority: Priority): Todo {
    return {
      id: `temp-${Date.now()}`,
      title,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: "",
      isGuest: true,
    };
  }
}
```

## 7.5 동기화 관리자

```typescript
export class SyncManager {
  private pendingActions: PendingAction[] = [];
  private isOnline: boolean = navigator.onLine;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(private apiClient: TodoAPIClient) {
    this.setupNetworkListeners();
    this.startPeriodicSync();
  }

  private setupNetworkListeners(): void {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.processPendingActions();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  addPendingAction(
    action: Omit<PendingAction, "id" | "timestamp" | "retryCount">,
  ): void {
    const pendingAction: PendingAction = {
      ...action,
      id: generateId(),
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    this.pendingActions.push(pendingAction);

    if (this.isOnline) {
      this.processPendingActions();
    }
  }

  private async processPendingActions(): Promise<void> {
    const actionsToProcess = [...this.pendingActions];

    for (const action of actionsToProcess) {
      try {
        await this.processAction(action);
        this.removePendingAction(action.id);
      } catch (error) {
        await this.handleActionError(action, error);
      }
    }
  }

  private async processAction(action: PendingAction): Promise<void> {
    switch (action.type) {
      case "create":
        await this.apiClient.createTodo(action.payload);
        break;
      case "update":
        await this.apiClient.updateTodo(action.payload.id, action.payload);
        break;
      case "delete":
        await this.apiClient.deleteTodo(action.payload.id);
        break;
    }
  }

  private async handleActionError(
    action: PendingAction,
    error: unknown,
  ): Promise<void> {
    action.retryCount++;

    if (action.retryCount >= 3) {
      // 최대 재시도 횟수 초과
      this.removePendingAction(action.id);
      throw new Error(`Failed to sync action after 3 retries: ${action.type}`);
    }

    // 지수 백오프로 재시도 스케줄링
    const delay = Math.pow(2, action.retryCount) * 1000;
    const timeoutId = setTimeout(() => {
      this.processAction(action);
    }, delay);

    this.retryTimeouts.set(action.id, timeoutId);
  }

  private removePendingAction(actionId: string): void {
    this.pendingActions = this.pendingActions.filter(
      (action) => action.id !== actionId,
    );

    const timeoutId = this.retryTimeouts.get(actionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.retryTimeouts.delete(actionId);
    }
  }
}
```

## 7.6 API 요청/응답 타입

```typescript
// 요청 타입들
interface GetTodosParams {
  limit?: number;
  cursor?: string;
  filter?: FilterType;
  sortBy?: SortBy;
  sortOrder?: "asc" | "desc";
}

interface CreateTodoRequest {
  title: string;
  description?: string;
  priority: Priority;
}

interface UpdateTodoRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  completed?: boolean;
}

// 응답 타입들
interface APIResponse<T> {
  success: boolean;
  data: T;
}

interface GetTodosResponse {
  todos: Todo[];
  pagination: {
    hasNextPage: boolean;
    nextCursor: string | null;
    totalCount: number;
  };
  metadata: {
    userLimits: {
      maxItems: number;
      currentCount: number;
      isGuest: boolean;
    };
  };
}

interface CreateTodoResponse {
  todo: Todo;
  remainingQuota?: number;
}

interface UpdateTodoResponse {
  todo: Todo;
}

interface DeleteTodoResponse {
  deletedId: string;
}

interface GuestTokenResponse {
  guestToken: string;
  sessionId: string;
  expiresIn: number;
  permissions: GuestPermissions;
  sampleTodos: Todo[];
}
```

---

**이전**: [데이터 플로우](06-data-flow.md)  
**다음**: [보안 설계](08-security.md)
