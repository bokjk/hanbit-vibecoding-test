/**
 * Contract Testing 환경 관리 클래스
 * OpenAPI 스키마 로드, Mock 서버 관리, 테스트 환경 설정
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import OpenAPIBackend from 'openapi-backend';
import { OpenAPIV3 } from 'openapi-types';
import nock from 'nock';
import { logger } from '@/utils/logger';

export class ContractTestEnvironment {
  private openApiSpec: OpenAPIV3.Document | null = null;
  private openApiBackend: OpenAPIBackend | null = null;
  private mockServerScope: nock.Scope | null = null;

  /**
   * OpenAPI 스키마 초기화
   */
  async initializeSchema(): Promise<void> {
    try {
      // OpenAPI YAML 파일 로드
      const schemaPath = path.resolve(__dirname, '../../../openapi/api-schema.yaml');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const parsedSpec = yaml.parse(schemaContent) as OpenAPIV3.Document;
      
      // 스키마 검증
      this.openApiSpec = await SwaggerParser.validate(parsedSpec) as OpenAPIV3.Document;
      
      // OpenAPI Backend 초기화
      this.openApiBackend = new OpenAPIBackend({
        definition: this.openApiSpec,
        validate: true,
        ajvOpts: {
          strict: false,
          validateFormats: true,
          formats: {
            // 커스텀 포맷 검증 추가
            'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
          },
        },
      });

      await this.openApiBackend.init();
      
      logger.info('✅ OpenAPI 스키마 로드 및 검증 완료');
    } catch (error) {
      logger.error('❌ OpenAPI 스키마 초기화 실패', error as Error);
      throw error;
    }
  }

  /**
   * Mock 서버 설정
   */
  async setupMockServer(): Promise<void> {
    try {
      // Nock을 사용한 HTTP Mock 설정
      this.mockServerScope = nock('https://api.todo-app.example.com')
        .persist() // 지속적인 모킹
        .defaultReplyHeaders({
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        });

      logger.info('✅ Mock 서버 설정 완료');
    } catch (error) {
      logger.error('❌ Mock 서버 설정 실패', error as Error);
      throw error;
    }
  }

  /**
   * Mock 서버 정리
   */
  async teardownMockServer(): Promise<void> {
    try {
      if (this.mockServerScope) {
        this.mockServerScope.persist(false);
        nock.cleanAll();
      }
      
      logger.info('✅ Mock 서버 정리 완료');
    } catch (error) {
      logger.error('❌ Mock 서버 정리 실패', error as Error);
    }
  }

  /**
   * 테스트 상태 초기화
   */
  async resetTestState(): Promise<void> {
    // 각 테스트별 상태 초기화
    if (this.mockServerScope) {
      // 기존 Mock 요청 제거
      nock.cleanAll();
      await this.setupMockServer();
    }
  }

  /**
   * 테스트 후 정리
   */
  async cleanupTestState(): Promise<void> {
    // 테스트 후 상태 정리
    if (this.mockServerScope) {
      // 특정 Mock 인터셉터만 제거
      this.mockServerScope.interceptors.length = 0;
    }
  }

  /**
   * 요청 스키마 검증
   */
  validateRequest(method: string, path: string, requestData: {
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  }): boolean {
    if (!this.openApiBackend) {
      throw new Error('OpenAPI Backend가 초기화되지 않았습니다');
    }

    try {
      const result = this.openApiBackend.validateRequest(
        {
          method: method.toLowerCase(),
          path,
          body: requestData.body,
          query: requestData.query,
          headers: requestData.headers,
        },
        path
      );

      return result.valid;
    } catch (error) {
      logger.error('요청 스키마 검증 실패', error as Error, {
        method,
        path,
        requestData
      });
      return false;
    }
  }

  /**
   * 응답 스키마 검증
   */
  validateResponse(method: string, path: string, statusCode: number, responseData: unknown): boolean {
    if (!this.openApiBackend) {
      throw new Error('OpenAPI Backend가 초기화되지 않았습니다');
    }

    try {
      const result = this.openApiBackend.validateResponse(
        responseData,
        {
          method: method.toLowerCase(),
          path,
          status: statusCode,
        }
      );

      return result.valid;
    } catch (error) {
      logger.error('응답 스키마 검증 실패', error as Error, {
        method,
        path,
        statusCode,
        responseData
      });
      return false;
    }
  }

  /**
   * 특정 엔드포인트 스키마 정보 조회
   */
  getEndpointSchema(method: string, path: string): OpenAPIV3.OperationObject | null {
    if (!this.openApiSpec) {
      throw new Error('OpenAPI 스키마가 로드되지 않았습니다');
    }

    const methodLower = method.toLowerCase() as keyof OpenAPIV3.PathItemObject;
    const pathItem = this.openApiSpec.paths[path];
    
    if (!pathItem || typeof pathItem !== 'object') {
      return null;
    }

    return pathItem[methodLower];
  }

  /**
   * CORS 헤더 검증
   */
  validateCorsHeaders(headers: Record<string, string>): boolean {
    const requiredCorsHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ];

    return requiredCorsHeaders.every(header => 
      Object.keys(headers).some(h => h.toLowerCase() === header.toLowerCase())
    );
  }

  /**
   * Rate Limiting 헤더 검증
   */
  validateRateLimitHeaders(headers: Record<string, string>): boolean {
    const rateLimitHeaders = [
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
    ];

    // Rate Limit 헤더가 있으면 모두 있어야 함
    const hasAnyRateLimitHeader = rateLimitHeaders.some(header =>
      Object.keys(headers).some(h => h.toLowerCase() === header.toLowerCase())
    );

    if (!hasAnyRateLimitHeader) {
      return true; // Rate Limit 헤더가 없는 것은 허용
    }

    return rateLimitHeaders.every(header =>
      Object.keys(headers).some(h => h.toLowerCase() === header.toLowerCase())
    );
  }

  /**
   * 보안 헤더 검증
   */
  validateSecurityHeaders(headers: Record<string, string>): {
    hasContentType: boolean;
    hasCors: boolean;
    hasRateLimit: boolean;
  } {
    return {
      hasContentType: Object.keys(headers).some(h => 
        h.toLowerCase() === 'content-type'
      ),
      hasCors: this.validateCorsHeaders(headers),
      hasRateLimit: this.validateRateLimitHeaders(headers),
    };
  }

  /**
   * OpenAPI 스키마 getter
   */
  get schema(): OpenAPIV3.Document | null {
    return this.openApiSpec;
  }

  /**
   * OpenAPI Backend getter
   */
  get backend(): OpenAPIBackend | null {
    return this.openApiBackend;
  }
}