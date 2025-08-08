/**
 * 공통 상수 정의
 */

// Priority를 literal type으로 정의
export type Priority = 'low' | 'medium' | 'high';

// Priority 값들을 객체로 정의
export const Priority = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
} as const;
