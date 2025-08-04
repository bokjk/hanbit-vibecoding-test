import { Priority } from '@hanbit/types';

/**
 * API 요청/응답 타입 정의
 */

// 공통 API 응답 타입
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// TODO 관련 API 타입
export interface CreateTodoRequest {
  title: string;
  priority?: Priority;
  dueDate?: string;
}

export interface UpdateTodoRequest {
  title?: string;
  completed?: boolean;
  priority?: Priority;
  dueDate?: string;
}

export interface ListTodosRequest {
  status?: 'all' | 'active' | 'completed';
  priority?: Priority;
  limit?: number;
  cursor?: string; // for pagination
}

// 인증 관련 API 타입
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}