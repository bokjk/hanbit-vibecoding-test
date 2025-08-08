/**
 * DynamoDB 데이터 모델 타입 정의
 *
 * Single Table Design을 위한 엔티티 타입들과
 * DynamoDB 작업을 위한 유틸리티 타입들을 정의합니다.
 */

import { Priority } from './constants';

// ==========================================
// DynamoDB 기본 아이템 타입
// ==========================================

/**
 * DynamoDB 테이블의 기본 키 구조
 */
export interface DynamoBaseItem {
  PK: string; // Partition Key
  SK: string; // Sort Key
  EntityType: string; // 엔티티 타입 구분자
}

/**
 * GSI 키를 포함하는 아이템
 */
export interface DynamoItemWithGSI extends DynamoBaseItem {
  GSI1PK?: string; // GSI1 Partition Key (상태/우선순위 쿼리용)
  GSI1SK?: string; // GSI1 Sort Key
  GSI2PK?: string; // GSI2 Partition Key (제목 검색용)
  GSI2SK?: string; // GSI2 Sort Key
}

/**
 * TTL을 포함하는 아이템
 */
export interface DynamoItemWithTTL extends DynamoItemWithGSI {
  ttl?: number; // TTL Unix timestamp (게스트 데이터용)
}

// ==========================================
// 엔티티별 DynamoDB 아이템 타입
// ==========================================

/**
 * DynamoDB에 저장되는 Todo 아이템
 */
export interface DynamoTodoItem extends DynamoItemWithTTL {
  // 기본 키 (User 기반)
  PK: string; // USER#<userId>
  SK: string; // TODO#<todoId>
  EntityType: 'TODO';

  // GSI1: 상태 및 우선순위 쿼리
  GSI1PK: string; // USER#<userId>#STATUS#<completed>
  GSI1SK: string; // PRIORITY#<priority>#<createdAt>

  // GSI2: 제목 검색
  GSI2PK: string; // USER#<userId>
  GSI2SK: string; // TITLE#<title.toLowerCase()>#<createdAt>

  // Todo 데이터
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;

  // 사용자 관련
  userId: string;
  isGuest: boolean;
  sessionId?: string;

  // TTL (게스트 사용자만)
  ttl?: number;
}

/**
 * DynamoDB에 저장되는 User 프로필 아이템
 */
export interface DynamoUserItem extends DynamoBaseItem {
  // 기본 키
  PK: string; // USER#<userId>
  SK: string; // PROFILE
  EntityType: 'USER_PROFILE';

  // User 데이터
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DynamoDB에 저장되는 게스트 세션 아이템
 */
export interface DynamoGuestSessionItem extends DynamoItemWithTTL {
  // 기본 키
  PK: string; // SESSION#<sessionId>
  SK: string; // METADATA
  EntityType: 'GUEST_SESSION';

  // 세션 데이터
  sessionId: string;
  createdAt: string;
  lastAccessAt: string;

  // TTL (24시간 후 자동 삭제)
  ttl: number;
}

// ==========================================
// 쿼리 옵션 및 결과 타입
// ==========================================

/**
 * DynamoDB AttributeValue 타입
 */
export type DynamoAttributeValue =
  | { S: string }
  | { N: string }
  | { B: Uint8Array }
  | { SS: string[] }
  | { NS: string[] }
  | { BS: Uint8Array[] }
  | { M: Record<string, DynamoAttributeValue> }
  | { L: DynamoAttributeValue[] }
  | { NULL: boolean }
  | { BOOL: boolean };

/**
 * DynamoDB 키 타입
 */
export type DynamoKey = Record<string, DynamoAttributeValue>;

/**
 * DynamoDB 쿼리 옵션
 */
export interface DynamoQueryOptions {
  limit?: number;
  exclusiveStartKey?: DynamoKey;
  scanIndexForward?: boolean; // 정렬 순서 (true: 오름차순, false: 내림차순)
  consistentRead?: boolean;
}

/**
 * DynamoDB 쿼리 결과
 */
export interface DynamoQueryResult<T> {
  items: T[];
  lastEvaluatedKey?: DynamoKey;
  count: number;
  scannedCount: number;
}

/**
 * Todo 필터링 옵션
 */
export interface TodoFilterOptions {
  completed?: boolean;
  priority?: Priority;
  searchTitle?: string;
  sortBy?: 'createdDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// ==========================================
// 에러 타입
// ==========================================

/**
 * DynamoDB 관련 에러
 */
export class DynamoDBError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'DynamoDBError';
  }
}

/**
 * 아이템을 찾을 수 없을 때의 에러
 */
export class ItemNotFoundError extends DynamoDBError {
  constructor(entityType: string, key: string) {
    super(`${entityType} with key ${key} not found`, 'ITEM_NOT_FOUND', 404);
  }
}

// ==========================================
// 레거시 호환성을 위한 별명들
// ==========================================

/**
 * @deprecated DynamoTodoItem을 사용하세요
 */
export type TodoDynamoDBItem = DynamoTodoItem;

/**
 * @deprecated DynamoUserItem을 사용하세요
 */
export type UserDynamoDBItem = DynamoUserItem;
