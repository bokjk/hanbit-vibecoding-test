import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as constructs from 'constructs';
import * as path from 'path';
import { Duration } from 'aws-cdk-lib';

/**
 * 종합적인 헬스 체크 시스템
 * 애플리케이션, 인프라, 의존성 서비스 상태 모니터링
 * 자동 복구 메커니즘 및 상태 기반 알림 트리거
 */

export interface HealthCheckConfig {
  name: string;
  description: string;
  type: 'APPLICATION' | 'INFRASTRUCTURE' | 'DEPENDENCY' | 'SYNTHETIC';
  endpoint?: string;
  timeout: Duration;
  interval: Duration;
  retryAttempts: number;
  successCriteria: SuccessCriteria;
  autoRecovery?: RecoveryAction[];
}

export interface SuccessCriteria {
  expectedStatusCode?: number;
  maxResponseTime?: number; // milliseconds
  requiredContent?: string;
  customValidation?: string; // Lambda 함수명
}

export interface RecoveryAction {
  type: 'RESTART_SERVICE' | 'SCALE_UP' | 'FAILOVER' | 'CLEAR_CACHE' | 'CUSTOM';
  target: string;
  priority: number;
  cooldownMinutes: number;
}

export interface DependencyService {
  name: string;
  type: 'DATABASE' | 'EXTERNAL_API' | 'AWS_SERVICE' | 'CACHE';
  healthCheckUrl?: string;
  region?: string;
  timeout: Duration;
  criticalityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export class HealthCheckDefinitions {
  /**
   * 애플리케이션 헬스 체크 정의
   */
  static readonly APPLICATION_HEALTH_CHECKS: HealthCheckConfig[] = [
    {
      name: 'todo-api-health',
      description: 'Todo API 기본 기능 상태 확인',
      type: 'APPLICATION',
      endpoint: '/health',
      timeout: Duration.seconds(10),
      interval: Duration.minutes(2),
      retryAttempts: 3,
      successCriteria: {
        expectedStatusCode: 200,
        maxResponseTime: 2000,
        requiredContent: '"status":"healthy"',
      },
      autoRecovery: [
        {
          type: 'RESTART_SERVICE',
          target: 'lambda-functions',
          priority: 1,
          cooldownMinutes: 10,
        },
      ],
    },
    {
      name: 'todo-crud-operations',
      description: 'Todo CRUD 작업 종합 테스트',
      type: 'SYNTHETIC',
      timeout: Duration.seconds(30),
      interval: Duration.minutes(5),
      retryAttempts: 2,
      successCriteria: {
        customValidation: 'validate-todo-operations',
      },
      autoRecovery: [
        {
          type: 'CLEAR_CACHE',
          target: 'api-gateway',
          priority: 1,
          cooldownMinutes: 5,
        },
        {
          type: 'RESTART_SERVICE',
          target: 'lambda-functions',
          priority: 2,
          cooldownMinutes: 15,
        },
      ],
    },
    {
      name: 'auth-system-health',
      description: '인증 시스템 상태 및 토큰 검증',
      type: 'APPLICATION',
      endpoint: '/auth/validate',
      timeout: Duration.seconds(5),
      interval: Duration.minutes(3),
      retryAttempts: 2,
      successCriteria: {
        expectedStatusCode: 200,
        maxResponseTime: 1000,
      },
    },
  ];

  /**
   * 인프라 헬스 체크 정의
   */
  static readonly INFRASTRUCTURE_HEALTH_CHECKS: HealthCheckConfig[] = [
    {
      name: 'api-gateway-health',
      description: 'API Gateway 응답성 및 처리량 확인',
      type: 'INFRASTRUCTURE',
      timeout: Duration.seconds(15),
      interval: Duration.minutes(2),
      retryAttempts: 3,
      successCriteria: {
        maxResponseTime: 3000,
      },
    },
    {
      name: 'lambda-cold-start',
      description: 'Lambda 콜드 스타트 시간 모니터링',
      type: 'INFRASTRUCTURE',
      timeout: Duration.seconds(20),
      interval: Duration.minutes(10),
      retryAttempts: 2,
      successCriteria: {
        maxResponseTime: 5000, // 콜드 스타트 허용 시간
      },
      autoRecovery: [
        {
          type: 'SCALE_UP',
          target: 'lambda-provisioned-concurrency',
          priority: 1,
          cooldownMinutes: 30,
        },
      ],
    },
  ];

  /**
   * 의존성 서비스 정의
   */
  static readonly DEPENDENCY_SERVICES: DependencyService[] = [
    {
      name: 'dynamodb',
      type: 'DATABASE',
      region: 'ap-northeast-2',
      timeout: Duration.seconds(5),
      criticalityLevel: 'CRITICAL',
    },
    {
      name: 'cloudwatch',
      type: 'AWS_SERVICE',
      region: 'ap-northeast-2',
      timeout: Duration.seconds(10),
      criticalityLevel: 'HIGH',
    },
    {
      name: 'sns',
      type: 'AWS_SERVICE',
      region: 'ap-northeast-2',
      timeout: Duration.seconds(5),
      criticalityLevel: 'HIGH',
    },
  ];
}

export class HealthCheckSystem extends constructs.Construct {
  public readonly healthCheckFunctions: Map<string, lambda.Function> = new Map();
  public readonly autoRecoveryFunctions: Map<string, lambda.Function> = new Map();
  public readonly healthMetrics: cloudwatch.Metric[] = [];

  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    this.createHealthCheckFunctions();
    this.createAutoRecoverySystem();
    this.createHealthCheckSchedules();
    this.createHealthMetrics();
  }

  /**
   * 헬스 체크 Lambda 함수들 생성
   */
  private createHealthCheckFunctions(): void {
    // 메인 헬스 체크 오케스트레이터
    const healthCheckOrchestrator = new lambda.Function(this, 'HealthCheckOrchestrator', {
      functionName: 'TodoApp-HealthCheck-Orchestrator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'health-orchestrator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../lambda/health-checks')),
      timeout: Duration.minutes(5),
      environment: {
        HEALTH_CHECKS_CONFIG: JSON.stringify([
          ...HealthCheckDefinitions.APPLICATION_HEALTH_CHECKS,
          ...HealthCheckDefinitions.INFRASTRUCTURE_HEALTH_CHECKS,
        ]),
        DEPENDENCY_SERVICES_CONFIG: JSON.stringify(HealthCheckDefinitions.DEPENDENCY_SERVICES),
      },
      deadLetterQueueEnabled: true,
      retryAttempts: 1,
    });

    this.healthCheckFunctions.set('orchestrator', healthCheckOrchestrator);

    // 개별 헬스 체크 함수들
    [
      ...HealthCheckDefinitions.APPLICATION_HEALTH_CHECKS,
      ...HealthCheckDefinitions.INFRASTRUCTURE_HEALTH_CHECKS,
    ].forEach(healthCheck => {
      if (healthCheck.successCriteria.customValidation) {
        const customValidationFunction = new lambda.Function(
          this,
          `HealthCheck-${healthCheck.name}`,
          {
            functionName: `TodoApp-HealthCheck-${healthCheck.name}`,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: `${healthCheck.successCriteria.customValidation}.handler`,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../lambda/health-checks')),
            timeout: healthCheck.timeout,
            environment: {
              HEALTH_CHECK_CONFIG: JSON.stringify(healthCheck),
            },
          }
        );

        this.healthCheckFunctions.set(healthCheck.name, customValidationFunction);
      }
    });
  }

  /**
   * 자동 복구 시스템 생성
   */
  private createAutoRecoverySystem(): void {
    // 자동 복구 오케스트레이터
    const autoRecoveryOrchestrator = new lambda.Function(this, 'AutoRecoveryOrchestrator', {
      functionName: 'TodoApp-AutoRecovery-Orchestrator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'auto-recovery-orchestrator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../lambda/auto-recovery')),
      timeout: Duration.minutes(10),
      environment: {
        RECOVERY_ACTIONS_CONFIG: JSON.stringify(this.getRecoveryActionsConfig()),
      },
    });

    this.autoRecoveryFunctions.set('orchestrator', autoRecoveryOrchestrator);

    // 개별 복구 액션 함수들
    const recoveryActions = ['restart-service', 'scale-up', 'clear-cache', 'failover'];

    recoveryActions.forEach(action => {
      const recoveryFunction = new lambda.Function(this, `AutoRecovery-${action}`, {
        functionName: `TodoApp-AutoRecovery-${action}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: `${action}.handler`,
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../lambda/auto-recovery')),
        timeout: Duration.minutes(5),
      });

      this.autoRecoveryFunctions.set(action, recoveryFunction);
    });
  }

  /**
   * 헬스 체크 스케줄링
   */
  private createHealthCheckSchedules(): void {
    // 종합 헬스 체크 스케줄 (2분마다)
    const comprehensiveHealthCheckRule = new events.Rule(this, 'ComprehensiveHealthCheckSchedule', {
      ruleName: 'TodoApp-ComprehensiveHealthCheck',
      description: 'Todo 앱 종합 헬스 체크 실행',
      schedule: events.Schedule.rate(Duration.minutes(2)),
    });

    const orchestrator = this.healthCheckFunctions.get('orchestrator');
    if (orchestrator) {
      comprehensiveHealthCheckRule.addTarget(
        new targets.LambdaFunction(orchestrator, {
          event: events.RuleTargetInput.fromObject({
            checkType: 'comprehensive',
            timestamp: events.EventField.fromPath('$.time'),
          }),
        })
      );
    }

    // 심층 헬스 체크 스케줄 (10분마다)
    const deepHealthCheckRule = new events.Rule(this, 'DeepHealthCheckSchedule', {
      ruleName: 'TodoApp-DeepHealthCheck',
      description: 'Todo 앱 심층 의존성 체크',
      schedule: events.Schedule.rate(Duration.minutes(10)),
    });

    if (orchestrator) {
      deepHealthCheckRule.addTarget(
        new targets.LambdaFunction(orchestrator, {
          event: events.RuleTargetInput.fromObject({
            checkType: 'deep',
            includeDependencies: true,
            timestamp: events.EventField.fromPath('$.time'),
          }),
        })
      );
    }

    // 합성 트랜잭션 테스트 (5분마다)
    const syntheticTestRule = new events.Rule(this, 'SyntheticTestSchedule', {
      ruleName: 'TodoApp-SyntheticTests',
      description: 'Todo 앱 합성 트랜잭션 테스트',
      schedule: events.Schedule.rate(Duration.minutes(5)),
    });

    if (orchestrator) {
      syntheticTestRule.addTarget(
        new targets.LambdaFunction(orchestrator, {
          event: events.RuleTargetInput.fromObject({
            checkType: 'synthetic',
            testScenarios: ['create-todo', 'list-todos', 'update-todo', 'delete-todo'],
            timestamp: events.EventField.fromPath('$.time'),
          }),
        })
      );
    }
  }

  /**
   * 헬스 메트릭 생성
   */
  private createHealthMetrics(): void {
    // 전체 시스템 건강도 메트릭
    const systemHealthMetric = new cloudwatch.Metric({
      namespace: 'TodoApp/HealthChecks',
      metricName: 'SystemHealthScore',
      dimensionsMap: {
        Service: 'TodoApp',
      },
      statistic: cloudwatch.Statistic.AVERAGE,
      period: Duration.minutes(5),
    });

    this.healthMetrics.push(systemHealthMetric);

    // 컴포넌트별 건강도 메트릭
    const componentTypes = ['Application', 'Infrastructure', 'Dependencies'];
    componentTypes.forEach(type => {
      const metric = new cloudwatch.Metric({
        namespace: 'TodoApp/HealthChecks',
        metricName: 'ComponentHealth',
        dimensionsMap: {
          ComponentType: type,
        },
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(5),
      });

      this.healthMetrics.push(metric);
    });

    // 자동 복구 성공률 메트릭
    const autoRecoveryMetric = new cloudwatch.Metric({
      namespace: 'TodoApp/AutoRecovery',
      metricName: 'RecoverySuccessRate',
      statistic: cloudwatch.Statistic.AVERAGE,
      period: Duration.minutes(15),
    });

    this.healthMetrics.push(autoRecoveryMetric);

    // 응답 시간 메트릭
    const responseTimeMetric = new cloudwatch.Metric({
      namespace: 'TodoApp/HealthChecks',
      metricName: 'HealthCheckResponseTime',
      statistic: cloudwatch.Statistic.AVERAGE,
      period: Duration.minutes(5),
    });

    this.healthMetrics.push(responseTimeMetric);
  }

  /**
   * 헬스 체크 상태 기반 알람 생성
   */
  public createHealthAlarms(): cloudwatch.Alarm[] {
    const alarms: cloudwatch.Alarm[] = [];

    // 시스템 전체 건강도 알람
    const systemHealthAlarm = new cloudwatch.Alarm(this, 'SystemHealthDegraded', {
      alarmName: 'TodoApp-SystemHealthDegraded',
      alarmDescription: '시스템 전체 건강도가 임계값 이하로 떨어짐',
      metric:
        this.healthMetrics.find(m => m.metricName === 'SystemHealthScore') ||
        new cloudwatch.Metric({
          namespace: 'TodoApp/HealthChecks',
          metricName: 'SystemHealthScore',
          statistic: cloudwatch.Statistic.AVERAGE,
          period: Duration.minutes(5),
        }),
      threshold: 70, // 70% 이하
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    alarms.push(systemHealthAlarm);

    // 헬스 체크 실패 알람
    const healthCheckFailureAlarm = new cloudwatch.Alarm(this, 'HealthCheckFailures', {
      alarmName: 'TodoApp-HealthCheckFailures',
      alarmDescription: '연속적인 헬스 체크 실패',
      metric: new cloudwatch.Metric({
        namespace: 'TodoApp/HealthChecks',
        metricName: 'FailedChecks',
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(10),
      }),
      threshold: 5, // 10분간 5회 이상 실패
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    alarms.push(healthCheckFailureAlarm);

    // 자동 복구 실패 알람
    const autoRecoveryFailureAlarm = new cloudwatch.Alarm(this, 'AutoRecoveryFailures', {
      alarmName: 'TodoApp-AutoRecoveryFailures',
      alarmDescription: '자동 복구 시스템 실패',
      metric: new cloudwatch.Metric({
        namespace: 'TodoApp/AutoRecovery',
        metricName: 'FailedRecoveries',
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(15),
      }),
      threshold: 3, // 15분간 3회 이상 복구 실패
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    alarms.push(autoRecoveryFailureAlarm);

    return alarms;
  }

  /**
   * 복구 액션 설정 추출
   */
  private getRecoveryActionsConfig(): RecoveryAction[] {
    const allRecoveryActions: RecoveryAction[] = [];

    [
      ...HealthCheckDefinitions.APPLICATION_HEALTH_CHECKS,
      ...HealthCheckDefinitions.INFRASTRUCTURE_HEALTH_CHECKS,
    ].forEach(healthCheck => {
      if (healthCheck.autoRecovery) {
        allRecoveryActions.push(...healthCheck.autoRecovery);
      }
    });

    return allRecoveryActions;
  }

  /**
   * 헬스 체크 대시보드 위젯 생성
   */
  public createHealthDashboardWidgets(): Record<string, unknown>[] {
    return [
      {
        type: 'metric',
        properties: {
          title: '시스템 전체 건강도',
          metrics: [
            ['TodoApp/HealthChecks', 'SystemHealthScore'],
            ['TodoApp/AutoRecovery', 'RecoverySuccessRate'],
          ],
          period: 300,
          stat: 'Average',
          region: 'ap-northeast-2',
          yAxis: {
            left: {
              min: 0,
              max: 100,
            },
          },
        },
      },
      {
        type: 'metric',
        properties: {
          title: '컴포넌트별 건강도',
          metrics: [
            ['TodoApp/HealthChecks', 'ComponentHealth', 'ComponentType', 'Application'],
            ['.', '.', '.', 'Infrastructure'],
            ['.', '.', '.', 'Dependencies'],
          ],
          period: 300,
          stat: 'Average',
          region: 'ap-northeast-2',
        },
      },
      {
        type: 'log',
        properties: {
          title: '헬스 체크 로그',
          query: `SOURCE '/aws/lambda/TodoApp-HealthCheck-Orchestrator'\n| fields @timestamp, @message\n| filter @message like /ERROR/ or @message like /RECOVERY/\n| sort @timestamp desc\n| limit 100`,
          region: 'ap-northeast-2',
        },
      },
    ];
  }

  /**
   * 상태 보고서 생성 (주간/월간)
   */
  public createHealthReports(): void {
    // 주간 헬스 보고서 생성 스케줄
    const weeklyReportRule = new events.Rule(this, 'WeeklyHealthReport', {
      ruleName: 'TodoApp-WeeklyHealthReport',
      description: '주간 시스템 건강도 보고서 생성',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '9',
        weekDay: 'MON',
      }),
    });

    const reportFunction = new lambda.Function(this, 'HealthReportGenerator', {
      functionName: 'TodoApp-HealthReportGenerator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'health-report-generator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../lambda/reporting')),
      timeout: Duration.minutes(10),
      environment: {
        REPORT_TYPE: 'weekly',
        METRICS_NAMESPACE: 'TodoApp/HealthChecks',
      },
    });

    weeklyReportRule.addTarget(new targets.LambdaFunction(reportFunction));
  }
}
