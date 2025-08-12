import type { Todo, Priority, FilterType } from "types/index";

// ================================
// 기본 API 응답 타입들
// ================================

/**
 * API 성공 응답 기본 형태
 */
export interface APIResponse<T> {
  success: true;
  data: T;
}

/**
 * API 에러 응답 기본 형태
 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

/**
 * 페이지네이션 정보
 */
export interface PaginationInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
  totalCount: number;
}

/**
 * 사용자 한도 정보
 */
export interface UserLimits {
  maxItems: number;
  currentCount: number;
  isGuest: boolean;
}

// ================================
// TODO API 요청 타입들
// ================================

/**
 * TODO 목록 조회 파라미터
 */
export interface GetTodosParams {
  limit?: number;
  cursor?: string;
  filter?: FilterType;
  sortBy?: "createdAt" | "priority" | "title";
  sortOrder?: "asc" | "desc";
}

/**
 * TODO 생성 요청
 */
export interface CreateTodoRequest {
  title: string;
  description?: string;
  priority: Priority;
}

/**
 * TODO 수정 요청
 */
export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  completed?: boolean;
}

// ================================
// TODO API 응답 타입들
// ================================

/**
 * TODO 목록 조회 응답
 */
export interface GetTodosResponse {
  todos: Todo[];
  pagination: PaginationInfo;
  metadata: {
    userLimits: UserLimits;
  };
}

/**
 * TODO 생성 응답
 */
export interface CreateTodoResponse {
  todo: Todo;
  remainingQuota?: number;
}

/**
 * TODO 단일 조회 응답
 */
export interface GetTodoResponse {
  todo: Todo;
}

/**
 * TODO 수정 응답
 */
export interface UpdateTodoResponse {
  todo: Todo;
}

/**
 * TODO 삭제 응답
 */
export interface DeleteTodoResponse {
  deletedId: string;
}

// ================================
// 인증 API 타입들
// ================================

/**
 * 게스트 권한 정보
 */
export interface GuestPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  maxItems: number;
  canExport: boolean;
}

/**
 * 인증된 사용자 권한 정보
 */
export interface AuthenticatedPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  maxItems: number;
  canExport: boolean;
  canImport: boolean;
  canShare: boolean;
}

/**
 * 사용자 정보
 */
export interface User {
  id: string;
  email?: string;
  username?: string;
  isGuest: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * 게스트 토큰 발급 응답
 */
export interface GuestTokenResponse {
  guestToken: string;
  sessionId: string;
  expiresIn: number;
  permissions: GuestPermissions;
  sampleTodos: Todo[];
}

/**
 * 토큰 갱신 응답
 */
export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

/**
 * 사용자 정보 조회 응답
 */
export interface UserInfoResponse {
  user: User;
  permissions: GuestPermissions | AuthenticatedPermissions;
}

// ================================
// 데이터 관리 API 타입들
// ================================

/**
 * 데이터 내보내기 응답
 */
export interface ExportDataResponse {
  exportUrl: string;
  expiresAt: string;
  format: string;
  totalItems: number;
}

/**
 * 데이터 가져오기 옵션
 */
export interface ImportOptions {
  mergeStrategy: "replace" | "merge";
  validateData: boolean;
}

/**
 * 데이터 가져오기 응답
 */
export interface ImportDataResponse {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * localStorage 마이그레이션 옵션
 */
export interface MigrationOptions {
  preserveIds: boolean;
  mergeStrategy: "replace" | "merge";
}

/**
 * localStorage 마이그레이션 요청
 */
export interface MigrateDataRequest {
  localStorageData: Todo[];
  migrationOptions: MigrationOptions;
}

/**
 * localStorage 마이그레이션 응답
 */
export interface MigrateDataResponse {
  migratedCount: number;
  duplicateCount: number;
  totalCount: number;
}

// ================================
// 에러 코드 열거형
// ================================

export enum APIErrorCode {
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

  // 네트워크 관련
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
}

// ================================
// 동기화 관련 타입들
// ================================

/**
 * 대기 중인 액션 타입
 */
export type PendingActionType = "create" | "update" | "delete";

/**
 * 대기 중인 액션
 */
export interface PendingAction {
  id: string;
  type: PendingActionType;
  payload: unknown;
  optimisticId?: string;
  timestamp: string;
  retryCount: number;
}

// ================================
// HTTP 클라이언트 설정 타입들
// ================================

/**
 * HTTP 요청 설정
 */
export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}
