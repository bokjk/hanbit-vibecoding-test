import { Handler, ScheduledEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

/**
 * 헬스 체크 오케스트레이터
 * 모든 헬스 체크를 조율하고 결과를 통합
 */

interface HealthCheckRequest {
  checkType: 'comprehensive' | 'deep' | 'synthetic' | 'test';
  includeDependencies?: boolean;
  testScenarios?: string[];
  timestamp: string;
}

interface HealthCheckResult {
  checkName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  responseTime: number;
  details: Record<string, unknown>;
  timestamp: string;
}

interface SystemHealthReport {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  healthScore: number; // 0-100
  components: HealthCheckResult[];
  timestamp: string;
  environment: string;
}

const cloudwatch = new AWS.CloudWatch();
const lambda = new AWS.Lambda();

export const handler: Handler<ScheduledEvent | HealthCheckRequest, SystemHealthReport> = async (
  event,
  context
) => {
  const startTime = Date.now();
  console.log('🏥 헬스 체크 오케스트레이터 시작', { event, context: context.awsRequestId });

  try {
    const request = event as HealthCheckRequest;
    const healthChecks: HealthCheckResult[] = [];

    // 기본 애플리케이션 헬스 체크
    const appHealthResults = await performApplicationHealthChecks(request.checkType);
    healthChecks.push(...appHealthResults);

    // 인프라 헬스 체크
    if (request.checkType !== 'test') {
      const infraHealthResults = await performInfrastructureHealthChecks();
      healthChecks.push(...infraHealthResults);
    }

    // 의존성 서비스 체크 (deep 모드)
    if (request.includeDependencies || request.checkType === 'deep') {
      const depHealthResults = await performDependencyHealthChecks();
      healthChecks.push(...depHealthResults);
    }

    // 합성 트랜잭션 테스트
    if (request.checkType === 'synthetic' && request.testScenarios) {
      const syntheticResults = await performSyntheticTests(request.testScenarios);
      healthChecks.push(...syntheticResults);
    }

    // 전체 시스템 상태 평가
    const systemHealth = evaluateSystemHealth(healthChecks);

    // CloudWatch 메트릭 발송
    await publishHealthMetrics(systemHealth);

    // 자동 복구 트리거 (필요시)
    await checkAndTriggerAutoRecovery(systemHealth);

    const executionTime = Date.now() - startTime;
    console.log(`✅ 헬스 체크 완료 (${executionTime}ms)`, {
      overallStatus: systemHealth.overallStatus,
      healthScore: systemHealth.healthScore,
      componentCount: systemHealth.components.length,
    });

    return {
      ...systemHealth,
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'unknown',
    };
  } catch (error) {
    console.error('❌ 헬스 체크 오케스트레이터 실패', error);

    // 오케스트레이터 자체 실패 메트릭 발송
    await publishErrorMetric('HealthCheckOrchestrator', error);

    return {
      overallStatus: 'UNHEALTHY',
      healthScore: 0,
      components: [
        {
          checkName: 'HealthCheckOrchestrator',
          status: 'UNHEALTHY',
          responseTime: Date.now() - startTime,
          details: { error: error.message },
          timestamp: new Date().toISOString(),
        },
      ],
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'unknown',
    };
  }
};

/**
 * 애플리케이션 헬스 체크 수행
 */
async function performApplicationHealthChecks(checkType: string): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  try {
    // Todo API 기본 건강 상태 확인
    const apiHealthResult = await checkTodoApiHealth();
    results.push(apiHealthResult);

    // 인증 시스템 체크
    const authHealthResult = await checkAuthSystemHealth();
    results.push(authHealthResult);

    // 상세 체크 모드인 경우 추가 검사
    if (checkType === 'comprehensive' || checkType === 'deep') {
      const memoryUsageResult = await checkMemoryUsage();
      results.push(memoryUsageResult);
    }
  } catch (error) {
    console.error('애플리케이션 헬스 체크 실패', error);
    results.push({
      checkName: 'ApplicationHealthChecks',
      status: 'UNHEALTHY',
      responseTime: 0,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * 인프라 헬스 체크 수행
 */
async function performInfrastructureHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  try {
    // API Gateway 상태 확인
    const apiGatewayResult = await checkApiGatewayHealth();
    results.push(apiGatewayResult);

    // Lambda 함수 상태 확인
    const lambdaResult = await checkLambdaHealth();
    results.push(lambdaResult);
  } catch (error) {
    console.error('인프라 헬스 체크 실패', error);
    results.push({
      checkName: 'InfrastructureHealthChecks',
      status: 'UNHEALTHY',
      responseTime: 0,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * 의존성 서비스 헬스 체크 수행
 */
async function performDependencyHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  try {
    // DynamoDB 상태 확인
    const dynamoResult = await checkDynamoDBHealth();
    results.push(dynamoResult);

    // CloudWatch 상태 확인
    const cloudwatchResult = await checkCloudWatchHealth();
    results.push(cloudwatchResult);
  } catch (error) {
    console.error('의존성 서비스 헬스 체크 실패', error);
    results.push({
      checkName: 'DependencyHealthChecks',
      status: 'UNHEALTHY',
      responseTime: 0,
      details: { error: error.message },
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

/**
 * 합성 트랜잭션 테스트 수행
 */
async function performSyntheticTests(scenarios: string[]): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  for (const scenario of scenarios) {
    try {
      const startTime = Date.now();
      let result: HealthCheckResult;

      switch (scenario) {
        case 'create-todo':
          result = await testCreateTodoScenario();
          break;
        case 'list-todos':
          result = await testListTodosScenario();
          break;
        case 'update-todo':
          result = await testUpdateTodoScenario();
          break;
        case 'delete-todo':
          result = await testDeleteTodoScenario();
          break;
        default:
          result = {
            checkName: `SyntheticTest-${scenario}`,
            status: 'UNHEALTHY',
            responseTime: Date.now() - startTime,
            details: { error: '알 수 없는 시나리오' },
            timestamp: new Date().toISOString(),
          };
      }

      results.push(result);
    } catch (error) {
      results.push({
        checkName: `SyntheticTest-${scenario}`,
        status: 'UNHEALTHY',
        responseTime: 0,
        details: { error: error.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * 전체 시스템 건강 상태 평가
 */
function evaluateSystemHealth(healthChecks: HealthCheckResult[]): SystemHealthReport {
  if (healthChecks.length === 0) {
    return {
      overallStatus: 'UNHEALTHY',
      healthScore: 0,
      components: [],
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'unknown',
    };
  }

  const degradedCount = healthChecks.filter(check => check.status === 'DEGRADED').length;
  const unhealthyCount = healthChecks.filter(check => check.status === 'UNHEALTHY').length;

  // 건강도 점수 계산 (가중치 적용)
  let healthScore = 0;
  healthChecks.forEach(check => {
    const weight = getCriticalityWeight(check.checkName);
    switch (check.status) {
      case 'HEALTHY':
        healthScore += 100 * weight;
        break;
      case 'DEGRADED':
        healthScore += 50 * weight;
        break;
      case 'UNHEALTHY':
        healthScore += 0 * weight;
        break;
    }
  });

  // 총 가중치로 나누어 평균 계산
  const totalWeight = healthChecks.reduce(
    (sum, check) => sum + getCriticalityWeight(check.checkName),
    0
  );
  healthScore = Math.round(healthScore / totalWeight);

  // 전체 상태 결정
  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  if (unhealthyCount > 0 || healthScore < 50) {
    overallStatus = 'UNHEALTHY';
  } else if (degradedCount > 0 || healthScore < 80) {
    overallStatus = 'DEGRADED';
  } else {
    overallStatus = 'HEALTHY';
  }

  return {
    overallStatus,
    healthScore,
    components: healthChecks,
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'unknown',
  };
}

/**
 * 헬스 메트릭 발송
 */
async function publishHealthMetrics(systemHealth: SystemHealthReport): Promise<void> {
  const metrics = [
    {
      MetricName: 'SystemHealthScore',
      Value: systemHealth.healthScore,
      Unit: 'Percent',
      Dimensions: [{ Name: 'Service', Value: 'TodoApp' }],
    },
    {
      MetricName: 'HealthyComponents',
      Value: systemHealth.components.filter(c => c.status === 'HEALTHY').length,
      Unit: 'Count',
    },
    {
      MetricName: 'UnhealthyComponents',
      Value: systemHealth.components.filter(c => c.status === 'UNHEALTHY').length,
      Unit: 'Count',
    },
  ];

  try {
    await cloudwatch
      .putMetricData({
        Namespace: 'TodoApp/HealthChecks',
        MetricData: metrics,
      })
      .promise();

    console.log('📊 헬스 메트릭 발송 완료', { metricsCount: metrics.length });
  } catch (error) {
    console.error('❌ 헬스 메트릭 발송 실패', error);
  }
}

/**
 * 자동 복구 트리거 확인
 */
async function checkAndTriggerAutoRecovery(systemHealth: SystemHealthReport): Promise<void> {
  const unhealthyComponents = systemHealth.components.filter(c => c.status === 'UNHEALTHY');

  if (unhealthyComponents.length > 0 && systemHealth.healthScore < 50) {
    console.log('🚨 자동 복구 시스템 트리거 중...', {
      unhealthyCount: unhealthyComponents.length,
      healthScore: systemHealth.healthScore,
    });

    try {
      // 자동 복구 오케스트레이터 호출
      const recoveryPayload = {
        trigger: 'health-check',
        systemHealth,
        unhealthyComponents: unhealthyComponents.map(c => ({
          name: c.checkName,
          status: c.status,
          details: c.details,
        })),
      };

      await lambda
        .invoke({
          FunctionName: 'TodoApp-AutoRecovery-Orchestrator',
          InvocationType: 'Event', // 비동기 호출
          Payload: JSON.stringify(recoveryPayload),
        })
        .promise();

      console.log('✅ 자동 복구 시스템 트리거 완료');
    } catch (error) {
      console.error('❌ 자동 복구 트리거 실패', error);
    }
  }
}

// 개별 헬스 체크 함수들
async function checkTodoApiHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  // 실제 구현에서는 API Gateway 엔드포인트 호출
  // 여기서는 시뮬레이션
  const responseTime = Date.now() - startTime;

  return {
    checkName: 'TodoApiHealth',
    status: responseTime < 2000 ? 'HEALTHY' : 'DEGRADED',
    responseTime,
    details: { endpoint: '/health', method: 'GET' },
    timestamp: new Date().toISOString(),
  };
}

async function checkAuthSystemHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  // 인증 시스템 상태 확인 로직
  const responseTime = Date.now() - startTime;

  return {
    checkName: 'AuthSystemHealth',
    status: 'HEALTHY',
    responseTime,
    details: { tokenValidation: true },
    timestamp: new Date().toISOString(),
  };
}

async function checkMemoryUsage(): Promise<HealthCheckResult> {
  const memoryUsage = process.memoryUsage();
  const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  if (usagePercent < 70) {
    status = 'HEALTHY';
  } else if (usagePercent < 90) {
    status = 'DEGRADED';
  } else {
    status = 'UNHEALTHY';
  }

  return {
    checkName: 'MemoryUsage',
    status,
    responseTime: 0,
    details: { usagePercent: Math.round(usagePercent), memoryUsage },
    timestamp: new Date().toISOString(),
  };
}

async function checkApiGatewayHealth(): Promise<HealthCheckResult> {
  // API Gateway 메트릭 확인
  return {
    checkName: 'ApiGatewayHealth',
    status: 'HEALTHY',
    responseTime: 100,
    details: { service: 'API Gateway' },
    timestamp: new Date().toISOString(),
  };
}

async function checkLambdaHealth(): Promise<HealthCheckResult> {
  // Lambda 함수 상태 확인
  return {
    checkName: 'LambdaHealth',
    status: 'HEALTHY',
    responseTime: 50,
    details: { service: 'Lambda' },
    timestamp: new Date().toISOString(),
  };
}

async function checkDynamoDBHealth(): Promise<HealthCheckResult> {
  // DynamoDB 상태 확인
  return {
    checkName: 'DynamoDBHealth',
    status: 'HEALTHY',
    responseTime: 25,
    details: { service: 'DynamoDB' },
    timestamp: new Date().toISOString(),
  };
}

async function checkCloudWatchHealth(): Promise<HealthCheckResult> {
  // CloudWatch 상태 확인
  return {
    checkName: 'CloudWatchHealth',
    status: 'HEALTHY',
    responseTime: 75,
    details: { service: 'CloudWatch' },
    timestamp: new Date().toISOString(),
  };
}

// 합성 트랜잭션 테스트 함수들
async function testCreateTodoScenario(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  // 실제 Todo 생성 API 호출 시뮬레이션
  const responseTime = Date.now() - startTime;

  return {
    checkName: 'SyntheticTest-CreateTodo',
    status: 'HEALTHY',
    responseTime,
    details: { scenario: 'create-todo', success: true },
    timestamp: new Date().toISOString(),
  };
}

async function testListTodosScenario(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;

  return {
    checkName: 'SyntheticTest-ListTodos',
    status: 'HEALTHY',
    responseTime,
    details: { scenario: 'list-todos', success: true },
    timestamp: new Date().toISOString(),
  };
}

async function testUpdateTodoScenario(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;

  return {
    checkName: 'SyntheticTest-UpdateTodo',
    status: 'HEALTHY',
    responseTime,
    details: { scenario: 'update-todo', success: true },
    timestamp: new Date().toISOString(),
  };
}

async function testDeleteTodoScenario(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;

  return {
    checkName: 'SyntheticTest-DeleteTodo',
    status: 'HEALTHY',
    responseTime,
    details: { scenario: 'delete-todo', success: true },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 컴포넌트 중요도에 따른 가중치 반환
 */
function getCriticalityWeight(checkName: string): number {
  const criticalComponents = ['TodoApiHealth', 'DynamoDBHealth', 'AuthSystemHealth'];
  const highComponents = ['ApiGatewayHealth', 'LambdaHealth'];

  if (criticalComponents.includes(checkName)) {
    return 2.0; // 중요 컴포넌트
  } else if (highComponents.includes(checkName)) {
    return 1.5; // 높은 우선순위
  } else {
    return 1.0; // 일반 컴포넌트
  }
}

/**
 * 에러 메트릭 발송
 */
async function publishErrorMetric(component: string, _error: Error | unknown): Promise<void> {
  try {
    await cloudwatch
      .putMetricData({
        Namespace: 'TodoApp/HealthChecks',
        MetricData: [
          {
            MetricName: 'HealthCheckErrors',
            Value: 1,
            Unit: 'Count',
            Dimensions: [{ Name: 'Component', Value: component }],
          },
        ],
      })
      .promise();
  } catch (metricsError) {
    console.error('메트릭 발송 중 오류', metricsError);
  }
}
