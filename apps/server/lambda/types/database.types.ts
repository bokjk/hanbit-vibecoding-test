import { Priority } from '@hanbit/types';

/**
 * DynamoDB 관련 타입 정의
 * Single Table Design 패턴 사용
 */

// DynamoDB 기본 아이템 구조
export interface DynamoDBItem {
  PK: string;      // Partition Key
  SK: string;      // Sort Key  
  GSI1PK?: string; // Global Secondary Index 1 Partition Key
  GSI1SK?: string; // Global Secondary Index 1 Sort Key
  ttl?: number;    // Time to Live (Unix timestamp)
}

// TODO 아이템 DynamoDB 구조
export interface TodoDynamoDBItem extends DynamoDBItem {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  // DynamoDB keys
  PK: string;    // USER#{userId}
  SK: string;    // TODO#{todoId}
  GSI1PK?: string; // TODO#{status}
  GSI1SK?: string; // {priority}#{createdAt}
}

// 사용자 아이템 DynamoDB 구조  
export interface UserDynamoDBItem extends DynamoDBItem {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  // DynamoDB keys
  PK: string;    // USER#{userId}
  SK: string;    // USER#{userId}
}

// 세션 아이템 DynamoDB 구조 (리프레시 토큰 관리용)
export interface SessionDynamoDBItem extends DynamoDBItem {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
  // DynamoDB keys
  PK: string;    // SESSION#{sessionId}
  SK: string;    // SESSION#{sessionId}
  ttl: number;   // 자동 삭제를 위한 TTL
}

// DynamoDB 키 패턴
export const DynamoDBKeyPatterns = {
  // 사용자 관련
  USER_PK: (userId: string) => `USER#${userId}`,
  USER_SK: (userId: string) => `USER#${userId}`,
  
  // TODO 관련
  TODO_PK: (userId: string) => `USER#${userId}`,
  TODO_SK: (todoId: string) => `TODO#${todoId}`,
  
  // GSI1 - TODO 상태별 조회용
  TODO_GSI1PK: (status: 'active' | 'completed') => `TODO#${status}`,
  TODO_GSI1SK: (priority: Priority, createdAt: string) => `${priority}#${createdAt}`,
  
  // 세션 관련
  SESSION_PK: (sessionId: string) => `SESSION#${sessionId}`,
  SESSION_SK: (sessionId: string) => `SESSION#${sessionId}`,
} as const;