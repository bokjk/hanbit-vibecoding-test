/**
 * DynamoDB Single Table Design 키 스키마 정의
 *
 * 이 파일은 DynamoDB 테이블의 키 생성 패턴을 정의합니다.
 * 모든 엔티티는 동일한 테이블에 저장되며, 키 패턴으로 구분됩니다.
 */

// ==========================================
// 기본 키 패턴 상수
// ==========================================

export const KEY_PATTERNS = {
  // 사용자 관련
  USER_PROFILE: 'USER#',

  // TODO 관련
  TODO: 'TODO#',

  // 세션 관련 (게스트)
  SESSION: 'SESSION#',

  // GSI 키 패턴
  GSI1: {
    STATUS: 'STATUS#',
    PRIORITY: 'PRIORITY#',
  },

  GSI2: {
    TITLE: 'TITLE#',
  },
} as const;

// ==========================================
// 키 생성 유틸리티 함수들
// ==========================================

/**
 * 기본 테이블 키 생성 함수들
 */
export class DynamoKeyBuilder {
  /**
   * 사용자 프로필 키 생성
   */
  static userProfile(userId: string) {
    return {
      PK: `${KEY_PATTERNS.USER_PROFILE}${userId}`,
      SK: 'PROFILE',
    };
  }

  /**
   * TODO 아이템 키 생성
   */
  static todoItem(userId: string, todoId: string) {
    return {
      PK: `${KEY_PATTERNS.USER_PROFILE}${userId}`,
      SK: `${KEY_PATTERNS.TODO}${todoId}`,
    };
  }

  /**
   * 게스트 세션 키 생성
   */
  static guestSession(sessionId: string) {
    return {
      PK: `${KEY_PATTERNS.SESSION}${sessionId}`,
      SK: 'METADATA',
    };
  }
}

/**
 * GSI1 키 생성 - 상태 및 우선순위 기반 쿼리용
 */
export class GSI1KeyBuilder {
  /**
   * 상태별 TODO 조회를 위한 GSI1 키
   * @param userId 사용자 ID
   * @param completed 완료 상태
   * @param priority 우선순위
   * @param createdAt 생성일시 (ISO string)
   */
  static statusPriority(userId: string, completed: boolean, priority: string, createdAt: string) {
    const status = completed ? 'COMPLETED' : 'ACTIVE';
    return {
      GSI1PK: `${KEY_PATTERNS.USER_PROFILE}${userId}#${KEY_PATTERNS.GSI1.STATUS}${status}`,
      GSI1SK: `${KEY_PATTERNS.GSI1.PRIORITY}${priority}#${createdAt}`,
    };
  }

  /**
   * 사용자의 모든 TODO 조회를 위한 GSI1 키 (상태 무관)
   */
  static allUserTodos(userId: string, priority: string, createdAt: string) {
    return {
      GSI1PK: `${KEY_PATTERNS.USER_PROFILE}${userId}`,
      GSI1SK: `${KEY_PATTERNS.GSI1.PRIORITY}${priority}#${createdAt}`,
    };
  }
}

/**
 * GSI2 키 생성 - 제목 검색 및 정렬용
 */
export class GSI2KeyBuilder {
  /**
   * 제목 기반 검색을 위한 GSI2 키
   * @param userId 사용자 ID
   * @param title TODO 제목 (검색을 위해 소문자 변환)
   * @param createdAt 생성일시 (정렬용)
   */
  static titleSearch(userId: string, title: string, createdAt: string) {
    const normalizedTitle = title.toLowerCase().trim();
    return {
      GSI2PK: `${KEY_PATTERNS.USER_PROFILE}${userId}`,
      GSI2SK: `${KEY_PATTERNS.GSI2.TITLE}${normalizedTitle}#${createdAt}`,
    };
  }
}

// ==========================================
// TTL 유틸리티
// ==========================================

/**
 * TTL 타임스탬프 생성 유틸리티
 */
export class TTLBuilder {
  /**
   * 게스트 데이터를 위한 7일 후 TTL 생성
   */
  static guestDataExpiry(): number {
    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일
    return Math.floor(expiry.getTime() / 1000); // Unix timestamp (초)
  }

  /**
   * 임시 세션을 위한 24시간 후 TTL 생성
   */
  static sessionExpiry(): number {
    const now = new Date();
    const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24시간
    return Math.floor(expiry.getTime() / 1000); // Unix timestamp (초)
  }
}

// ==========================================
// 쿼리 패턴 도우미
// ==========================================

/**
 * 일반적인 쿼리 패턴들
 */
export const QUERY_PATTERNS = {
  /**
   * 사용자의 모든 TODO 조회
   */
  GET_USER_TODOS: {
    keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
    values: (userId: string) => ({
      ':pk': `${KEY_PATTERNS.USER_PROFILE}${userId}`,
      ':sk': KEY_PATTERNS.TODO,
    }),
  },

  /**
   * 특정 상태의 TODO들 조회 (GSI1 사용)
   */
  GET_TODOS_BY_STATUS: {
    indexName: 'GSI1-StatusPriority',
    keyCondition: 'GSI1PK = :gsi1pk',
    values: (userId: string, completed: boolean) => {
      const status = completed ? 'COMPLETED' : 'ACTIVE';
      return {
        ':gsi1pk': `${KEY_PATTERNS.USER_PROFILE}${userId}#${KEY_PATTERNS.GSI1.STATUS}${status}`,
      };
    },
  },

  /**
   * 제목으로 TODO 검색 (GSI2 사용)
   */
  SEARCH_TODOS_BY_TITLE: {
    indexName: 'GSI2-SearchTitle',
    keyCondition: 'GSI2PK = :gsi2pk AND begins_with(GSI2SK, :titlePrefix)',
    values: (userId: string, titlePrefix: string) => ({
      ':gsi2pk': `${KEY_PATTERNS.USER_PROFILE}${userId}`,
      ':titlePrefix': `${KEY_PATTERNS.GSI2.TITLE}${titlePrefix.toLowerCase()}`,
    }),
  },
} as const;
