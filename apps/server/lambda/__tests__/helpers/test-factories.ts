/**
 * 테스트 데이터 팩토리
 * TDD 개발을 위한 테스트 데이터 생성 헬퍼 함수들
 */

import { Priority } from '@/types/constants';
import { DynamoTodoItem, DynamoUserItem, DynamoGuestSessionItem } from '@/types/database.types';
import {
  CreateTodoRequest,
  UpdateTodoRequest,
  AuthContext,
  CognitoTokenClaims,
} from '@/types/api.types';

// ==========================================
// 기본 유틸리티 함수들
// ==========================================

/**
 * 테스트용 고유 ID 생성
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 테스트용 날짜 문자열 생성
 */
export function generateTestDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

/**
 * TTL 타임스탬프 생성 (현재 시간 + 지정된 시간)
 */
export function generateTTL(offsetSeconds = 86400): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

// ==========================================
// API 요청/응답 팩토리
// ==========================================

export interface CreateTodoRequestOptions {
  title?: string;
  priority?: Priority;
  dueDate?: string;
}

/**
 * CreateTodoRequest 테스트 데이터 생성
 */
export function createCreateTodoRequest(options: CreateTodoRequestOptions = {}): CreateTodoRequest {
  return {
    title: options.title || `Test Todo ${generateTestId()}`,
    priority: options.priority || Priority.MEDIUM,
    dueDate: options.dueDate,
  };
}

export interface UpdateTodoRequestOptions {
  title?: string;
  completed?: boolean;
  priority?: Priority;
  dueDate?: string;
}

/**
 * UpdateTodoRequest 테스트 데이터 생성
 */
export function createUpdateTodoRequest(options: UpdateTodoRequestOptions = {}): UpdateTodoRequest {
  const request: UpdateTodoRequest = {};

  if (options.title !== undefined) request.title = options.title;
  if (options.completed !== undefined) request.completed = options.completed;
  if (options.priority !== undefined) request.priority = options.priority;
  if (options.dueDate !== undefined) request.dueDate = options.dueDate;

  return request;
}

// ==========================================
// DynamoDB 아이템 팩토리
// ==========================================

export interface DynamoTodoItemOptions {
  userId?: string;
  todoId?: string;
  title?: string;
  completed?: boolean;
  priority?: Priority;
  isGuest?: boolean;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
  ttl?: number;
}

/**
 * DynamoTodoItem 테스트 데이터 생성
 */
export function createDynamoTodoItem(options: DynamoTodoItemOptions = {}): DynamoTodoItem {
  const userId = options.userId || generateTestId('user');
  const todoId = options.todoId || generateTestId('todo');
  const title = options.title || `Test Todo ${todoId}`;
  const priority = options.priority || Priority.MEDIUM;
  const completed = options.completed || false;
  const isGuest = options.isGuest || false;
  const createdAt = options.createdAt || generateTestDate();
  const updatedAt = options.updatedAt || createdAt;

  return {
    // 기본 키
    PK: `USER#${userId}`,
    SK: `TODO#${todoId}`,
    EntityType: 'TODO',

    // GSI1: 상태 및 우선순위 쿼리
    GSI1PK: `USER#${userId}#STATUS#${completed}`,
    GSI1SK: `PRIORITY#${priority}#${createdAt}`,

    // GSI2: 제목 검색
    GSI2PK: `USER#${userId}`,
    GSI2SK: `TITLE#${title.toLowerCase()}#${createdAt}`,

    // Todo 데이터
    id: todoId,
    title,
    completed,
    priority,
    createdAt,
    updatedAt,

    // 사용자 관련
    userId,
    isGuest,
    sessionId: options.sessionId,

    // TTL (게스트 사용자만)
    ...(options.ttl && { ttl: options.ttl }),
  };
}

export interface DynamoUserItemOptions {
  userId?: string;
  email?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * DynamoUserItem 테스트 데이터 생성
 */
export function createDynamoUserItem(options: DynamoUserItemOptions = {}): DynamoUserItem {
  const userId = options.userId || generateTestId('user');
  const createdAt = options.createdAt || generateTestDate();

  return {
    // 기본 키
    PK: `USER#${userId}`,
    SK: 'PROFILE',
    EntityType: 'USER_PROFILE',

    // User 데이터
    id: userId,
    email: options.email || `test-${userId}@example.com`,
    name: options.name || `Test User ${userId}`,
    createdAt,
    updatedAt: options.updatedAt || createdAt,
  };
}

export interface DynamoGuestSessionItemOptions {
  sessionId?: string;
  createdAt?: string;
  lastAccessAt?: string;
  ttl?: number;
}

/**
 * DynamoGuestSessionItem 테스트 데이터 생성
 */
export function createDynamoGuestSessionItem(
  options: DynamoGuestSessionItemOptions = {}
): DynamoGuestSessionItem {
  const sessionId = options.sessionId || generateTestId('session');
  const createdAt = options.createdAt || generateTestDate();

  return {
    // 기본 키
    PK: `SESSION#${sessionId}`,
    SK: 'METADATA',
    EntityType: 'GUEST_SESSION',

    // 세션 데이터
    sessionId,
    createdAt,
    lastAccessAt: options.lastAccessAt || createdAt,

    // TTL (24시간 후 자동 삭제)
    ttl: options.ttl || generateTTL(86400),
  };
}

// ==========================================
// 인증 컨텍스트 팩토리
// ==========================================

export interface AuthContextOptions {
  userId?: string;
  userType?: 'authenticated' | 'guest';
  sessionId?: string;
  permissions?: Partial<{
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    persistData: boolean;
    maxItems: number;
  }>;
}

/**
 * AuthContext 테스트 데이터 생성
 */
export function createAuthContext(options: AuthContextOptions = {}): AuthContext {
  const userType = options.userType || 'authenticated';
  const userId = options.userId || generateTestId(userType === 'guest' ? 'guest' : 'user');

  const defaultPermissions = {
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    persistData: userType === 'authenticated',
    maxItems: userType === 'guest' ? 50 : 1000,
  };

  return {
    userId,
    userType,
    sessionId: options.sessionId,
    permissions: { ...defaultPermissions, ...options.permissions },
    tokenClaims: createCognitoTokenClaims({ userId, userType, sessionId: options.sessionId }),
  };
}

export interface CognitoTokenClaimsOptions {
  userId?: string;
  userType?: 'authenticated' | 'guest';
  sessionId?: string;
  exp?: number;
  iat?: number;
}

/**
 * CognitoTokenClaims 테스트 데이터 생성
 */
export function createCognitoTokenClaims(
  options: CognitoTokenClaimsOptions = {}
): CognitoTokenClaims {
  const now = Math.floor(Date.now() / 1000);
  const userType = options.userType || 'authenticated';
  const userId = options.userId || generateTestId(userType === 'guest' ? 'guest' : 'user');

  return {
    sub: userId,
    aud: 'test-client-id',
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool',
    exp: options.exp || now + 3600, // 1시간 후 만료
    iat: options.iat || now,
    token_use: 'access',
    'custom:user_type': userType,
    'custom:session_id': options.sessionId,
    'custom:permissions': JSON.stringify({
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      persistData: userType === 'authenticated',
      maxItems: userType === 'guest' ? 50 : 1000,
    }),
  };
}

// ==========================================
// 리스트 및 배치 생성 헬퍼
// ==========================================

/**
 * 여러 개의 DynamoTodoItem 생성
 */
export function createMultipleTodos(
  count: number,
  baseOptions: DynamoTodoItemOptions = {}
): DynamoTodoItem[] {
  return Array.from({ length: count }, (_, index) =>
    createDynamoTodoItem({
      ...baseOptions,
      todoId: baseOptions.todoId ? `${baseOptions.todoId}-${index}` : undefined,
      title: `Test Todo ${index + 1}`,
      priority: [Priority.LOW, Priority.MEDIUM, Priority.HIGH][index % 3],
      completed: index % 2 === 0,
    })
  );
}

/**
 * 복합 시나리오용 테스트 데이터 세트 생성
 */
export function createTestDataSet(userId?: string) {
  const testUserId = userId || generateTestId('user');

  return {
    userId: testUserId,
    authContext: createAuthContext({ userId: testUserId }),
    guestAuthContext: createAuthContext({
      userId: generateTestId('guest'),
      userType: 'guest',
      sessionId: generateTestId('session'),
    }),
    userProfile: createDynamoUserItem({ userId: testUserId }),
    todos: createMultipleTodos(5, { userId: testUserId }),
    guestTodos: createMultipleTodos(3, {
      userId: generateTestId('guest'),
      isGuest: true,
      sessionId: generateTestId('session'),
      ttl: generateTTL(),
    }),
  };
}
