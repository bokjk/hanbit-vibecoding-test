import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as constructs from 'constructs';
import { Duration } from 'aws-cdk-lib';

/**
 * 운영 리스크 관리를 위한 CloudWatch 알람 시스템
 * 심각도별 알람 분류 및 proactive 문제 해결 체계
 */

export interface AlarmConfiguration {
  name: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  threshold: number;
  evaluationPeriods: number;
  comparisonOperator: cloudwatch.ComparisonOperator;
  treatMissingData?: cloudwatch.TreatMissingData;
  datapointsToAlarm?: number;
}

export interface MetricConfiguration {
  namespace: string;
  metricName: string;
  dimensions?: Record<string, string>;
  statistic: cloudwatch.Statistic;
  period: Duration;
}

export class AlarmDefinitions {
  /**
   * CRITICAL 알람 - 즉각적인 대응 필요
   * 시스템 안정성에 직접적 영향을 미치는 상황
   */
  static readonly CRITICAL_ALARMS: Array<
    AlarmConfiguration & { metricConfig: MetricConfiguration }
  > = [
    {
      name: 'HighErrorRate',
      description: '5분간 에러율이 5% 초과 시 즉각적인 조치 필요',
      severity: 'CRITICAL',
      threshold: 5, // 5% 에러율
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      metricConfig: {
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(5),
      },
    },
    {
      name: 'HighLambdaErrorRate',
      description: 'Lambda 함수 에러율 10% 초과',
      severity: 'CRITICAL',
      threshold: 10,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(5),
      },
    },
    {
      name: 'DatabaseConnectionFailure',
      description: 'DynamoDB 연결 실패율 임계치 초과',
      severity: 'CRITICAL',
      threshold: 5,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(5),
      },
    },
    {
      name: 'ExtremeLatency',
      description: 'API 응답시간 5초 초과 - 사용자 경험 심각한 저하',
      severity: 'CRITICAL',
      threshold: 5000, // 5초
      evaluationPeriods: 2,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(5),
      },
    },
  ];

  /**
   * WARNING 알람 - 모니터링 및 예방적 조치 필요
   * 잠재적 문제나 성능 저하 상황
   */
  static readonly WARNING_ALARMS: Array<
    AlarmConfiguration & { metricConfig: MetricConfiguration }
  > = [
    {
      name: 'ElevatedErrorRate',
      description: '에러율 증가 추세 - 2% 초과 시 모니터링 강화',
      severity: 'WARNING',
      threshold: 2,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(10),
      },
    },
    {
      name: 'HighLatency',
      description: 'API 응답시간 2초 초과 - 성능 최적화 필요',
      severity: 'WARNING',
      threshold: 2000,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(5),
      },
    },
    {
      name: 'LambdaThrottling',
      description: 'Lambda 함수 스로틀링 발생',
      severity: 'WARNING',
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/Lambda',
        metricName: 'Throttles',
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(5),
      },
    },
    {
      name: 'HighMemoryUsage',
      description: 'Lambda 메모리 사용량 80% 초과',
      severity: 'WARNING',
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/Lambda',
        metricName: 'MemoryUtilization',
        statistic: cloudwatch.Statistic.MAXIMUM,
        period: Duration.minutes(5),
      },
    },
    {
      name: 'DatabaseReadCapacityHigh',
      description: 'DynamoDB 읽기 용량 80% 초과',
      severity: 'WARNING',
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/DynamoDB',
        metricName: 'ConsumedReadCapacityUnits',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: Duration.minutes(5),
      },
    },
  ];

  /**
   * INFO 알람 - 정보성 알림 및 트렌드 모니터링
   * 시스템 상태 정보 및 사용량 트렌드
   */
  static readonly INFO_ALARMS: Array<AlarmConfiguration & { metricConfig: MetricConfiguration }> = [
    {
      name: 'UnusualTrafficPattern',
      description: '비정상적인 트래픽 패턴 감지',
      severity: 'INFO',
      threshold: 1000, // 분당 요청 수
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      metricConfig: {
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(1),
      },
    },
    {
      name: 'LowTrafficAlert',
      description: '예상보다 낮은 트래픽 - 서비스 이용률 점검 필요',
      severity: 'INFO',
      threshold: 10,
      evaluationPeriods: 10,
      datapointsToAlarm: 8,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      metricConfig: {
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(5),
      },
    },
  ];

  /**
   * 복합 메트릭 기반 고급 알람
   * 여러 메트릭을 조합한 지능형 알람
   */
  static readonly COMPOSITE_ALARMS = [
    {
      name: 'SystemHealthDegraded',
      description: '시스템 전체 건강도 저하 - 복합 메트릭 기반 평가',
      severity: 'CRITICAL' as const,
      rule: '(HighErrorRate OR HighLatency) AND HighMemoryUsage',
    },
    {
      name: 'CascadingFailureRisk',
      description: '연쇄 장애 위험도 높음',
      severity: 'CRITICAL' as const,
      rule: 'DatabaseConnectionFailure AND LambdaThrottling',
    },
    {
      name: 'PerformanceDegradation',
      description: '성능 저하 패턴 감지',
      severity: 'WARNING' as const,
      rule: 'HighLatency AND (HighMemoryUsage OR DatabaseReadCapacityHigh)',
    },
  ];

  /**
   * 알람 임계값 동적 조정을 위한 기준값
   */
  static readonly THRESHOLD_BASELINES = {
    PEAK_HOURS: {
      ERROR_RATE_MULTIPLIER: 1.5,
      LATENCY_MULTIPLIER: 1.3,
      TRAFFIC_MULTIPLIER: 2.0,
    },
    OFF_HOURS: {
      ERROR_RATE_MULTIPLIER: 0.8,
      LATENCY_MULTIPLIER: 1.0,
      TRAFFIC_MULTIPLIER: 0.5,
    },
  };
}

export class TodoAppAlarmSystem extends constructs.Construct {
  public readonly alarms: cloudwatch.Alarm[] = [];
  public readonly compositeAlarms: cloudwatch.CompositeAlarm[] = [];

  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    this.createStandardAlarms();
    this.createCompositeAlarms();
  }

  /**
   * 표준 알람 생성
   */
  private createStandardAlarms(): void {
    const allAlarms = [
      ...AlarmDefinitions.CRITICAL_ALARMS,
      ...AlarmDefinitions.WARNING_ALARMS,
      ...AlarmDefinitions.INFO_ALARMS,
    ];

    allAlarms.forEach(alarmConfig => {
      const metric = new cloudwatch.Metric({
        namespace: alarmConfig.metricConfig.namespace,
        metricName: alarmConfig.metricConfig.metricName,
        dimensionsMap: alarmConfig.metricConfig.dimensions,
        statistic: alarmConfig.metricConfig.statistic,
        period: alarmConfig.metricConfig.period,
      });

      const alarm = new cloudwatch.Alarm(this, alarmConfig.name, {
        alarmName: `TodoApp-${alarmConfig.name}`,
        alarmDescription: alarmConfig.description,
        metric,
        threshold: alarmConfig.threshold,
        evaluationPeriods: alarmConfig.evaluationPeriods,
        datapointsToAlarm: alarmConfig.datapointsToAlarm,
        comparisonOperator: alarmConfig.comparisonOperator,
        treatMissingData: alarmConfig.treatMissingData,
      });

      // 알람에 태그 추가로 관리 효율성 향상
      alarm.node.addMetadata('severity', alarmConfig.severity);
      alarm.node.addMetadata('category', this.categorizeAlarm(alarmConfig.name));

      this.alarms.push(alarm);
    });
  }

  /**
   * 복합 알람 생성
   */
  private createCompositeAlarms(): void {
    AlarmDefinitions.COMPOSITE_ALARMS.forEach(compositeConfig => {
      const alarmMap = new Map<string, cloudwatch.Alarm>();

      // 참조된 알람들을 맵에 저장
      this.alarms.forEach(alarm => {
        const alarmName = alarm.alarmName.replace('TodoApp-', '');
        alarmMap.set(alarmName, alarm);
      });

      // 복합 알람 규칙을 CloudWatch 형식으로 변환
      const alarmRule = this.parseCompositeRule(compositeConfig.rule, alarmMap);

      if (alarmRule) {
        const compositeAlarm = new cloudwatch.CompositeAlarm(this, compositeConfig.name, {
          alarmDescription: compositeConfig.description,
          alarmRule,
        });

        compositeAlarm.node.addMetadata('severity', compositeConfig.severity);
        this.compositeAlarms.push(compositeAlarm);
      }
    });
  }

  /**
   * 복합 알람 규칙 파싱
   */
  private parseCompositeRule(
    rule: string,
    alarmMap: Map<string, cloudwatch.Alarm>
  ): cloudwatch.AlarmRule | null {
    try {
      // 간단한 규칙 파서 - 실제 구현에서는 더 정교한 파싱 필요
      const tokens = rule.split(/\s+(AND|OR)\s+/);

      if (tokens.length >= 3) {
        const leftAlarm = alarmMap.get(tokens[0]);
        const operator = tokens[1];
        const rightAlarm = alarmMap.get(tokens[2]);

        if (leftAlarm && rightAlarm) {
          if (operator === 'AND') {
            return cloudwatch.AlarmRule.allOf(
              cloudwatch.AlarmRule.fromAlarm(leftAlarm, cloudwatch.AlarmState.ALARM),
              cloudwatch.AlarmRule.fromAlarm(rightAlarm, cloudwatch.AlarmState.ALARM)
            );
          } else if (operator === 'OR') {
            return cloudwatch.AlarmRule.anyOf(
              cloudwatch.AlarmRule.fromAlarm(leftAlarm, cloudwatch.AlarmState.ALARM),
              cloudwatch.AlarmRule.fromAlarm(rightAlarm, cloudwatch.AlarmState.ALARM)
            );
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`복합 알람 규칙 파싱 실패: ${rule}`, error);
      return null;
    }
  }

  /**
   * 알람 카테고리 분류
   */
  private categorizeAlarm(alarmName: string): string {
    if (alarmName.toLowerCase().includes('error')) return 'reliability';
    if (alarmName.toLowerCase().includes('latency')) return 'performance';
    if (alarmName.toLowerCase().includes('memory') || alarmName.toLowerCase().includes('capacity'))
      return 'resource';
    if (alarmName.toLowerCase().includes('database')) return 'storage';
    if (alarmName.toLowerCase().includes('traffic')) return 'usage';

    return 'general';
  }

  /**
   * 알람 상태 요약 메트릭 생성
   */
  public createAlarmSummaryMetrics(): cloudwatch.MathExpression[] {
    const criticalAlarms = this.alarms.filter(alarm =>
      alarm.node.metadata.find(m => m.type === 'severity' && m.data === 'CRITICAL')
    );

    const warningAlarms = this.alarms.filter(alarm =>
      alarm.node.metadata.find(m => m.type === 'severity' && m.data === 'WARNING')
    );

    return [
      new cloudwatch.MathExpression({
        expression: `SUM([${criticalAlarms.map((_, i) => `m${i}`).join(',')}])`,
        usingMetrics: Object.fromEntries(criticalAlarms.map((alarm, i) => [`m${i}`, alarm.metric])),
        label: '심각한 알람 개수',
        period: Duration.minutes(5),
      }),
      new cloudwatch.MathExpression({
        expression: `SUM([${warningAlarms.map((_, i) => `w${i}`).join(',')}])`,
        usingMetrics: Object.fromEntries(warningAlarms.map((alarm, i) => [`w${i}`, alarm.metric])),
        label: '경고 알람 개수',
        period: Duration.minutes(5),
      }),
    ];
  }

  /**
   * 알람 임계값 동적 조정
   */
  public adjustThresholdsForTimeOfDay(isBusinessHours: boolean): void {
    const multipliers = isBusinessHours
      ? AlarmDefinitions.THRESHOLD_BASELINES.PEAK_HOURS
      : AlarmDefinitions.THRESHOLD_BASELINES.OFF_HOURS;

    // 구현 시 알람 임계값을 시간대별로 조정
    console.log(
      `알람 임계값을 ${isBusinessHours ? '업무시간' : '비업무시간'}에 맞게 조정:`,
      multipliers
    );
  }
}
