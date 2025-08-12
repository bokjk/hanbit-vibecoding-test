import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '@/utils/logger';
import { ResponseSecurity } from '@/utils/response-security';
import { CSPNonce } from '@/utils/csp-nonce';

/**
 * POST /csp-report - CSP 위반 보고서 처리
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  const origin = event.headers.Origin || event.headers.origin;

  try {
    logger.info('CSP report received', { requestId });

    // 요청 본문 검증
    if (!event.body) {
      logger.warn('Empty CSP report body', { requestId });
      return ResponseSecurity.createSecureErrorResponse(
        new Error('Empty report body'),
        400,
        { origin, requestId }
      );
    }

    // CSP 보고서 파싱
    let cspReport: {
      'document-uri'?: string;
      'violated-directive'?: string;
      'blocked-uri'?: string;
      'original-policy'?: string;
      referrer?: string;
    };
    try {
      const reportData = JSON.parse(event.body);
      cspReport = reportData['csp-report'];
      
      if (!cspReport) {
        throw new Error('Invalid report format');
      }
    } catch (parseError) {
      logger.warn('Invalid CSP report format', { requestId, error: parseError });
      return ResponseSecurity.createSecureErrorResponse(
        new Error('Invalid report format'),
        400,
        { origin, requestId }
      );
    }

    // 클라이언트 정보 수집
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];
    const clientIP = event.requestContext.identity.sourceIp;
    const timestamp = new Date().toISOString();

    // CSP 위반 로깅
    CSPNonce.logCSPViolation(cspReport, userAgent, clientIP);

    // 상세 로깅 (분석용)
    logger.info('CSP Violation Details', {
      requestId,
      documentUri: cspReport['document-uri'],
      referrer: cspReport.referrer,
      violatedDirective: cspReport['violated-directive'],
      originalPolicy: cspReport['original-policy'],
      blockedUri: cspReport['blocked-uri'],
      statusCode: cspReport['status-code'],
      sourceFile: cspReport['source-file'],
      lineNumber: cspReport['line-number'],
      columnNumber: cspReport['column-number'],
      userAgent,
      clientIP,
      timestamp
    });

    // 심각한 위반 감지 및 알림
    const seriousViolations = [
      'script-src', 
      'object-src', 
      'base-uri', 
      'unsafe-inline',
      'unsafe-eval'
    ];
    
    const violatedDirective = cspReport['violated-directive'] || '';
    const blockedUri = cspReport['blocked-uri'] || '';
    
    const isSeriousViolation = seriousViolations.some(violation => 
      violatedDirective.includes(violation) || blockedUri.includes('javascript:')
    );

    if (isSeriousViolation) {
      logger.error('Serious CSP violation detected', {
        requestId,
        directive: violatedDirective,
        blockedUri: blockedUri,
        userAgent,
        clientIP,
        documentUri: cspReport['document-uri']
      });

      // 프로덕션에서는 추가 알림 시스템 연동 가능
      // await notifySecurityTeam(cspReport, userAgent, clientIP);
    }

    // 통계 수집 (선택적)
    await collectCSPStatistics(cspReport, {
      userAgent,
      clientIP,
      timestamp,
      isSeriousViolation
    });

    // 204 No Content 응답 (표준)
    return {
      statusCode: 204,
      headers: {
        ...ResponseSecurity.getCorsHeaders(origin),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: ''
    };

  } catch (error) {
    logger.error('Error processing CSP report', error as Error, { requestId });
    
    return ResponseSecurity.createSecureErrorResponse(
      error as Error,
      500,
      { origin, requestId }
    );
  }
};

/**
 * CSP 통계 수집 (분석용)
 */
async function collectCSPStatistics(
  cspReport: {
    'violated-directive'?: string;
    'blocked-uri'?: string;
    'document-uri'?: string;
  },
  metadata: {
    userAgent?: string;
    clientIP?: string;
    timestamp: string;
    isSeriousViolation: boolean;
  }
): Promise<void> {
  try {
    // DynamoDB나 CloudWatch Metrics에 통계 저장
    const stats = {
      violatedDirective: cspReport['violated-directive'],
      blockedUri: cspReport['blocked-uri'],
      documentUri: cspReport['document-uri'],
      userAgent: metadata.userAgent,
      timestamp: metadata.timestamp,
      serious: metadata.isSeriousViolation
    };

    // 실제 구현 시 DynamoDB에 저장
    logger.info('CSP Statistics collected', stats);
  } catch (error) {
    logger.error('Failed to collect CSP statistics', error as Error);
  }
}

/**
 * CSP 위반 빈도 분석용 헬퍼
 */
export function analyzeCSPViolationTrends(reports: Array<{
  'violated-directive'?: string;
  'blocked-uri'?: string;
  timestamp?: string;
}>): {
  topViolations: Array<{ directive: string; count: number }>;
  commonBlockedUris: Array<{ uri: string; count: number }>;
  timeDistribution: Record<string, number>;
} {
  const violationCounts: Record<string, number> = {};
  const uriCounts: Record<string, number> = {};
  const timeDistribution: Record<string, number> = {};

  reports.forEach(report => {
    const directive = report['violated-directive'] || 'unknown';
    const uri = report['blocked-uri'] || 'unknown';
    const hour = new Date(report.timestamp).getHours();

    violationCounts[directive] = (violationCounts[directive] || 0) + 1;
    uriCounts[uri] = (uriCounts[uri] || 0) + 1;
    timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
  });

  const topViolations = Object.entries(violationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([directive, count]) => ({ directive, count }));

  const commonBlockedUris = Object.entries(uriCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([uri, count]) => ({ uri, count }));

  return {
    topViolations,
    commonBlockedUris,
    timeDistribution
  };
}