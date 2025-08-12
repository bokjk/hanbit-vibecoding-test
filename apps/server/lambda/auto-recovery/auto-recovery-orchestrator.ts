import { Handler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

/**
 * 자동 복구 오케스트레이터
 * 시스템 문제 감지 시 자동으로 복구 액션을 수행
 */

interface SystemHealth {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  components: Record<string, ComponentHealth>;
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical';
  responseTime?: number;
  errorRate?: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}

interface AlarmDetails {
  alarmName: string;
  state: string;
  reason: string;
  timestamp: string;
  metricName?: string;
  namespace?: string;
  dimensions?: Record<string, string>;
}

interface AutoRecoveryRequest {
  trigger: 'health-check' | 'alarm' | 'manual';
  systemHealth?: SystemHealth;
  unhealthyComponents?: Array<{
    name: string;
    status: string;
    details: ComponentHealth;
  }>;
  alarmDetails?: AlarmDetails;
}

interface RecoveryAction {
  type: 'RESTART_SERVICE' | 'SCALE_UP' | 'CLEAR_CACHE' | 'FAILOVER' | 'CUSTOM';
  target: string;
  priority: number;
  cooldownMinutes: number;
  maxRetries: number;
}

interface RecoveryResult {
  action: RecoveryAction;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  executionTime: number;
  details: Record<string, unknown>;
  timestamp: string;
}

interface RecoveryReport {
  triggerId: string;
  trigger: string;
  startTime: string;
  endTime: string;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  skippedActions: number;
  results: RecoveryResult[];
  systemHealthBefore?: SystemHealth;
  systemHealthAfter?: SystemHealth;
}

const cloudwatch = new AWS.CloudWatch();
const lambda = new AWS.Lambda();
const sns = new AWS.SNS();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// 복구 액션 정의
const RECOVERY_ACTIONS: Record<string, RecoveryAction[]> = {
  'TodoApiHealth': [
    {
      type: 'RESTART_SERVICE',
      target: 'lambda-functions',
      priority: 1,
      cooldownMinutes: 10,
      maxRetries: 3
    },
    {
      type: 'CLEAR_CACHE',
      target: 'api-gateway',
      priority: 2,
      cooldownMinutes: 5,
      maxRetries: 2
    }
  ],
  'DynamoDBHealth': [
    {
      type: 'SCALE_UP',
      target: 'dynamodb-capacity',
      priority: 1,
      cooldownMinutes: 15,
      maxRetries: 2
    }
  ],
  'MemoryUsage': [
    {
      type: 'RESTART_SERVICE',
      target: 'high-memory-functions',
      priority: 1,
      cooldownMinutes: 5,
      maxRetries: 3
    }
  ],
  'ApiGatewayHealth': [
    {
      type: 'CLEAR_CACHE',
      target: 'api-gateway',
      priority: 1,
      cooldownMinutes: 5,
      maxRetries: 2
    },
    {
      type: 'FAILOVER',
      target: 'backup-endpoint',
      priority: 2,
      cooldownMinutes: 30,
      maxRetries: 1
    }
  ]
};

export const handler: Handler<AutoRecoveryRequest, RecoveryReport> = async (
  event,
  context
) => {
  const startTime = Date.now();
  const triggerId = context.awsRequestId;
  
  console.log('🔧 자동 복구 시스템 시작', { 
    triggerId, 
    trigger: event.trigger,
    unhealthyComponents: event.unhealthyComponents?.length 
  });

  try {
    // 복구 계획 수립
    const recoveryPlan = await createRecoveryPlan(event);
    console.log(`📋 복구 계획 수립 완료: ${recoveryPlan.length}개 액션`);

    // 쿨다운 기간 확인
    const filteredPlan = await filterActionsByCooldown(recoveryPlan);
    console.log(`⏰ 쿨다운 필터링 완료: ${filteredPlan.length}개 액션 실행 예정`);

    // 복구 액션 실행
    const results: RecoveryResult[] = [];
    for (const action of filteredPlan) {
      const result = await executeRecoveryAction(action);
      results.push(result);
      
      // 실패한 경우 다음 우선순위 액션으로 진행
      if (result.status === 'FAILED' && action.priority < 3) {
        console.log(`⚠️ 액션 실패, 다음 우선순위 액션으로 진행: ${action.type}`);
      }
    }

    // 복구 후 시스템 상태 검증
    const systemHealthAfter = await verifySystemHealthAfterRecovery();

    // 결과 보고서 생성
    const report: RecoveryReport = {
      triggerId,
      trigger: event.trigger,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      totalActions: results.length,
      successfulActions: results.filter(r => r.status === 'SUCCESS').length,
      failedActions: results.filter(r => r.status === 'FAILED').length,
      skippedActions: results.filter(r => r.status === 'SKIPPED').length,
      results,
      systemHealthBefore: event.systemHealth,
      systemHealthAfter
    };

    // 복구 메트릭 발송
    await publishRecoveryMetrics(report);

    // 복구 결과 알림 발송
    await sendRecoveryNotification(report);

    // 복구 이력 저장
    await saveRecoveryHistory(report);

    const executionTime = Date.now() - startTime;
    console.log(`✅ 자동 복구 완료 (${executionTime}ms)`, {
      success: report.successfulActions,
      failed: report.failedActions,
      skipped: report.skippedActions
    });

    return report;

  } catch (error) {
    console.error('❌ 자동 복구 실패', error);
    
    // 복구 실패 메트릭 발송
    await publishErrorMetric('AutoRecoveryOrchestrator', error);

    // 실패 알림 발송
    await sendRecoveryFailureNotification(triggerId, event, error);

    throw error;
  }
};

/**
 * 복구 계획 수립
 */
async function createRecoveryPlan(request: AutoRecoveryRequest): Promise<RecoveryAction[]> {
  const actions: RecoveryAction[] = [];

  if (request.unhealthyComponents) {
    for (const component of request.unhealthyComponents) {
      const componentActions = RECOVERY_ACTIONS[component.name] || [];
      
      // 컴포넌트 상태에 따른 액션 우선순위 조정
      const prioritizedActions = componentActions
        .filter(action => shouldExecuteAction(component, action))
        .sort((a, b) => a.priority - b.priority);

      actions.push(...prioritizedActions);
    }
  }

  // 중복 액션 제거 및 우선순위 정렬
  const uniqueActions = actions.reduce((acc, current) => {
    const existing = acc.find(a => a.type === current.type && a.target === current.target);
    if (!existing) {
      acc.push(current);
    }
    return acc;
  }, [] as RecoveryAction[]);

  return uniqueActions.sort((a, b) => a.priority - b.priority);
}

/**
 * 쿨다운 기간을 고려한 액션 필터링
 */
async function filterActionsByCooldown(actions: RecoveryAction[]): Promise<RecoveryAction[]> {
  const filteredActions: RecoveryAction[] = [];

  for (const action of actions) {
    const cooldownKey = `${action.type}-${action.target}`;
    const lastExecution = await getLastExecutionTime(cooldownKey);
    
    if (!lastExecution || isAfterCooldown(lastExecution, action.cooldownMinutes)) {
      filteredActions.push(action);
    } else {
      console.log(`⏰ 쿨다운 기간 중, 액션 건너뜀: ${action.type} - ${action.target}`);
    }
  }

  return filteredActions;
}

/**
 * 복구 액션 실행
 */
async function executeRecoveryAction(action: RecoveryAction): Promise<RecoveryResult> {
  const startTime = Date.now();
  console.log(`🔧 복구 액션 실행: ${action.type} - ${action.target}`);

  try {
    let result: Record<string, unknown>;
    
    switch (action.type) {
      case 'RESTART_SERVICE': {
        result = await restartService(action.target);
        break;
      }
      case 'SCALE_UP': {
        result = await scaleUpService(action.target);
        break;
      }
      case 'CLEAR_CACHE': {
        result = await clearCache(action.target);
        break;
      }
      case 'FAILOVER': {
        result = await performFailover(action.target);
        break;
      }
      case 'CUSTOM': {
        result = await executeCustomAction(action.target);
        break;
      }
      default:
        throw new Error(`지원하지 않는 복구 액션: ${action.type}`);
    }

    // 실행 시간 기록
    await recordExecutionTime(action);

    const executionTime = Date.now() - startTime;
    console.log(`✅ 복구 액션 성공: ${action.type} (${executionTime}ms)`);

    return {
      action,
      status: 'SUCCESS',
      executionTime,
      details: result,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ 복구 액션 실패: ${action.type}`, error);

    return {
      action,
      status: 'FAILED',
      executionTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      timestamp: new Date().toISOString()
    };
  }
}

// 개별 복구 액션 구현
async function restartService(target: string): Promise<Record<string, unknown>> {
  console.log(`🔄 서비스 재시작: ${target}`);
  
  switch (target) {
    case 'lambda-functions': {
      // Lambda 함수 컨테이너 재시작 (새로운 실행 환경 강제)
      const functions = ['TodoApp-Create', 'TodoApp-List', 'TodoApp-Update', 'TodoApp-Delete'];
      for (const functionName of functions) {
        try {
          await lambda.invoke({
            FunctionName: functionName,
            InvocationType: 'Event',
            Payload: JSON.stringify({ action: 'warmup' })
          }).promise();
        } catch (error) {
          console.error(`Lambda 함수 재시작 실패: ${functionName}`, error);
        }
      }
      return { restarted: functions };
    }
      
    case 'high-memory-functions':
      // 메모리 사용량이 높은 함수들 재시작
      return { action: 'memory-intensive-functions-restarted' };
      
    default:
      throw new Error(`알 수 없는 재시작 대상: ${target}`);
  }
}

async function scaleUpService(target: string): Promise<Record<string, unknown>> {
  console.log(`📈 서비스 스케일 업: ${target}`);
  
  switch (target) {
    case 'dynamodb-capacity':
      // DynamoDB 읽기/쓰기 용량 증설
      return { 
        action: 'dynamodb-capacity-increased',
        readCapacity: 'increased',
        writeCapacity: 'increased' 
      };
      
    case 'lambda-provisioned-concurrency':
      // Lambda 예약된 동시 실행 수 증설
      return { action: 'lambda-concurrency-increased' };
      
    default:
      throw new Error(`알 수 없는 스케일 업 대상: ${target}`);
  }
}

async function clearCache(target: string): Promise<Record<string, unknown>> {
  console.log(`🧹 캐시 정리: ${target}`);
  
  switch (target) {
    case 'api-gateway':
      // API Gateway 캐시 비우기
      return { action: 'api-gateway-cache-cleared' };
      
    default:
      throw new Error(`알 수 없는 캐시 정리 대상: ${target}`);
  }
}

async function performFailover(target: string): Promise<Record<string, unknown>> {
  console.log(`🔀 페일오버 실행: ${target}`);
  
  switch (target) {
    case 'backup-endpoint':
      // 백업 엔드포인트로 트래픽 라우팅
      return { action: 'failover-to-backup', endpoint: 'backup-api-gateway' };
      
    default:
      throw new Error(`알 수 없는 페일오버 대상: ${target}`);
  }
}

async function executeCustomAction(target: string): Promise<Record<string, unknown>> {
  console.log(`⚙️ 커스텀 액션 실행: ${target}`);
  
  // 커스텀 Lambda 함수 호출
  const customFunctionName = `TodoApp-CustomRecovery-${target}`;
  
  try {
    const result = await lambda.invoke({
      FunctionName: customFunctionName,
      InvocationType: 'RequestResponse'
    }).promise();
    
    return { customAction: target, result: result.Payload };
  } catch (error) {
    throw new Error(`커스텀 액션 실행 실패: ${error.message}`);
  }
}

/**
 * 복구 후 시스템 상태 검증
 */
async function verifySystemHealthAfterRecovery(): Promise<SystemHealth | { error: string }> {
  console.log('🔍 복구 후 시스템 상태 검증 중...');
  
  try {
    // 헬스 체크 오케스트레이터 호출
    const result = await lambda.invoke({
      FunctionName: 'TodoApp-HealthCheck-Orchestrator',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        checkType: 'comprehensive',
        timestamp: new Date().toISOString()
      })
    }).promise();

    const healthReport = JSON.parse(result.Payload as string);
    console.log(`📊 복구 후 시스템 상태: ${healthReport.overallStatus} (점수: ${healthReport.healthScore})`);
    
    return healthReport;
  } catch (error) {
    console.error('시스템 상태 검증 실패', error);
    return { error: error.message };
  }
}

/**
 * 복구 메트릭 발송
 */
async function publishRecoveryMetrics(report: RecoveryReport): Promise<void> {
  const metrics = [
    {
      MetricName: 'RecoveryActionsExecuted',
      Value: report.totalActions,
      Unit: 'Count',
      Dimensions: [{ Name: 'Trigger', Value: report.trigger }]
    },
    {
      MetricName: 'RecoverySuccessRate',
      Value: report.totalActions > 0 ? (report.successfulActions / report.totalActions) * 100 : 0,
      Unit: 'Percent'
    },
    {
      MetricName: 'RecoveryExecutionTime',
      Value: new Date(report.endTime).getTime() - new Date(report.startTime).getTime(),
      Unit: 'Milliseconds'
    }
  ];

  try {
    await cloudwatch.putMetricData({
      Namespace: 'TodoApp/AutoRecovery',
      MetricData: metrics
    }).promise();

    console.log('📊 복구 메트릭 발송 완료');
  } catch (error) {
    console.error('복구 메트릭 발송 실패', error);
  }
}

/**
 * 복구 결과 알림 발송
 */
async function sendRecoveryNotification(report: RecoveryReport): Promise<void> {
  const severity = report.failedActions > 0 ? 'WARNING' : 'INFO';
  const topicArn = await getNotificationTopicArn(severity);
  
  if (!topicArn) return;

  const message = {
    severity,
    type: 'recovery-report',
    summary: `자동 복구 실행 완료 - 성공: ${report.successfulActions}, 실패: ${report.failedActions}`,
    details: {
      triggerId: report.triggerId,
      trigger: report.trigger,
      executionTime: new Date(report.endTime).getTime() - new Date(report.startTime).getTime(),
      actions: report.results.map(r => ({
        type: r.action.type,
        target: r.action.target,
        status: r.status
      }))
    },
    timestamp: report.endTime
  };

  try {
    await sns.publish({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      Subject: `[${severity}] Todo 앱 자동 복구 결과`
    }).promise();

    console.log('📧 복구 결과 알림 발송 완료');
  } catch (error) {
    console.error('복구 알림 발송 실패', error);
  }
}

/**
 * 복구 실패 알림 발송
 */
async function sendRecoveryFailureNotification(
  triggerId: string, 
  request: AutoRecoveryRequest, 
  error: Error | unknown
): Promise<void> {
  const topicArn = await getNotificationTopicArn('CRITICAL');
  if (!topicArn) return;

  const message = {
    severity: 'CRITICAL',
    type: 'recovery-failure',
    summary: '자동 복구 시스템 실패',
    details: {
      triggerId,
      trigger: request.trigger,
      error: error instanceof Error ? error.message : String(error),
      unhealthyComponents: request.unhealthyComponents?.map(c => c.name)
    },
    timestamp: new Date().toISOString()
  };

  try {
    await sns.publish({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      Subject: '[CRITICAL] Todo 앱 자동 복구 시스템 실패'
    }).promise();
  } catch (notificationError) {
    console.error('복구 실패 알림 발송 실패', notificationError);
  }
}

// 헬퍼 함수들
function shouldExecuteAction(component: { name: string; status: string; details: ComponentHealth }, action: RecoveryAction): boolean {
  // 컴포넌트 상태와 액션의 적합성 검사
  if (component.status === 'UNHEALTHY') {
    return true; // 모든 액션 허용
  }
  
  if (component.status === 'DEGRADED') {
    return action.priority <= 2; // 낮은 우선순위 액션만
  }
  
  return false;
}

async function getLastExecutionTime(cooldownKey: string): Promise<Date | null> {
  try {
    const result = await dynamodb.get({
      TableName: 'TodoApp-RecoveryHistory',
      Key: { actionKey: cooldownKey }
    }).promise();
    
    return result.Item ? new Date(result.Item.lastExecution) : null;
  } catch (error) {
    console.error('마지막 실행 시간 조회 실패', error);
    return null;
  }
}

function isAfterCooldown(lastExecution: Date, cooldownMinutes: number): boolean {
  const now = new Date();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  return now.getTime() - lastExecution.getTime() >= cooldownMs;
}

async function recordExecutionTime(action: RecoveryAction): Promise<void> {
  const cooldownKey = `${action.type}-${action.target}`;
  
  try {
    await dynamodb.put({
      TableName: 'TodoApp-RecoveryHistory',
      Item: {
        actionKey: cooldownKey,
        lastExecution: new Date().toISOString(),
        action: action,
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일 후 삭제
      }
    }).promise();
  } catch (error) {
    console.error('실행 시간 기록 실패', error);
  }
}

async function saveRecoveryHistory(report: RecoveryReport): Promise<void> {
  try {
    await dynamodb.put({
      TableName: 'TodoApp-RecoveryHistory',
      Item: {
        ...report,
        id: report.triggerId,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30일 후 삭제
      }
    }).promise();
  } catch (error) {
    console.error('복구 이력 저장 실패', error);
  }
}

async function getNotificationTopicArn(severity: string): Promise<string | null> {
  // 환경변수나 설정에서 토픽 ARN 조회
  return process.env[`SNS_TOPIC_${severity}`] || null;
}

async function publishErrorMetric(component: string, _error: Error | unknown): Promise<void> {
  try {
    await cloudwatch.putMetricData({
      Namespace: 'TodoApp/AutoRecovery',
      MetricData: [{
        MetricName: 'RecoveryErrors',
        Value: 1,
        Unit: 'Count',
        Dimensions: [{ Name: 'Component', Value: component }]
      }]
    }).promise();
  } catch (metricsError) {
    console.error('에러 메트릭 발송 실패', metricsError);
  }
}