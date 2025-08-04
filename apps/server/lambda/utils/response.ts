import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse } from '@/types/api.types';

/**
 * Lambda 응답 생성 유틸리티
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // 개발용, 프로덕션에서는 특정 도메인으로 제한
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

/**
 * 성공 응답 생성
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): APIGatewayProxyResult {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(
  error: Error,
  statusCode: number = 500
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.stack,
      }),
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * 검증 에러 응답 생성
 */
export function createValidationErrorResponse(
  message: string,
  details?: unknown
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'ValidationError',
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * 인증 에러 응답 생성
 */
export function createUnauthorizedResponse(
  message: string = 'Unauthorized'
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'UnauthorizedError',
      message,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * 찾을 수 없음 응답 생성
 */
export function createNotFoundResponse(
  resource: string = 'Resource'
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NotFoundError',
      message: `${resource} not found`,
    },
    timestamp: new Date().toISOString(),
  };

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}