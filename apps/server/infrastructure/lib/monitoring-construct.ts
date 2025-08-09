import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface MonitoringConstructProps {
  restApi: apigateway.RestApi;
  todoTable: dynamodb.Table;
  todoHandlers: {
    createTodo: lambda.Function;
    listTodos: lambda.Function;
    updateTodo: lambda.Function;
    deleteTodo: lambda.Function;
  };
  authHandlers: {
    login: lambda.Function;
    refresh: lambda.Function;
    guestAuth: lambda.Function;
  };
  alertEmail?: string;
}

/**
 * CloudWatch 모니터링 및 관찰가능성을 관리하는 Construct
 *
 * 주요 기능:
 * - Lambda 함수 메트릭 및 알람
 * - API Gateway 메트릭 및 성능 모니터링
 * - DynamoDB 메트릭 및 용량 모니터링
 * - X-Ray 트레이싱 설정
 * - 대시보드 생성
 * - 알림 설정 (SNS)
 */
export class MonitoringConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    const { restApi, todoTable, todoHandlers, authHandlers, alertEmail } = props;

    // 환경별 설정
    const stage = process.env.CDK_STAGE || 'dev';
    const isProduction = stage === 'prod';

    // SNS 알림 주제 생성
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `hanbit-todo-alarms-${stage}`,
      displayName: `Hanbit TODO Alarms (${stage})`,
    });

    // 이메일 알림 구독 (제공된 경우)
    if (alertEmail) {
      this.alarmTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));
    }

    // 모든 Lambda 함수들
    const allLambdaFunctions = [...Object.values(todoHandlers), ...Object.values(authHandlers)];

    // Lambda 함수별 알람 생성
    this.createLambdaAlarms(allLambdaFunctions, isProduction);

    // API Gateway 알람 생성
    this.createApiGatewayAlarms(restApi, isProduction);

    // DynamoDB 알람 생성
    this.createDynamoDBAlarms(todoTable, isProduction);

    // CloudWatch 대시보드 생성
    this.dashboard = this.createDashboard(stage, restApi, todoTable, allLambdaFunctions);

    // 로그 그룹 설정 (보존 기간 설정)
    this.configureLogGroups(allLambdaFunctions, isProduction);

    // X-Ray 관련 알람 생성
    this.createXRayAlarms(allLambdaFunctions, isProduction);

    // 태그 추가
    cdk.Tags.of(this).add('Component', 'Monitoring');
    cdk.Tags.of(this).add('Project', 'HanbitTodo');
  }

  /**
   * Lambda 함수 알람 생성
   */
  private createLambdaAlarms(functions: lambda.Function[], isProduction: boolean): void {
    functions.forEach(func => {
      const functionName = func.functionName;

      // 에러율 알람
      const errorRateAlarm = new cloudwatch.Alarm(this, `${functionName}ErrorRateAlarm`, {
        alarmName: `${functionName}-error-rate`,
        alarmDescription: `${functionName} 에러율이 임계치를 초과했습니다`,
        metric: func
          .metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: cloudwatch.Statistic.SUM,
          })
          .createAlarmMetric(),
        threshold: isProduction ? 10 : 5, // 프로덕션에서는 더 엄격
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

      // 응답 시간 알람
      const durationAlarm = new cloudwatch.Alarm(this, `${functionName}DurationAlarm`, {
        alarmName: `${functionName}-duration`,
        alarmDescription: `${functionName} 응답시간이 임계치를 초과했습니다`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: cloudwatch.Statistic.AVERAGE,
        }),
        threshold: isProduction ? 5000 : 10000, // ms
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

      // 스로틀링 알람
      const throttleAlarm = new cloudwatch.Alarm(this, `${functionName}ThrottleAlarm`, {
        alarmName: `${functionName}-throttle`,
        alarmDescription: `${functionName} 스로틀링이 발생했습니다`,
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: cloudwatch.Statistic.SUM,
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      throttleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    });
  }

  /**
   * API Gateway 알람 생성
   */
  private createApiGatewayAlarms(restApi: apigateway.RestApi, isProduction: boolean): void {
    // 4XX 에러 알람
    const clientErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway4XXErrorAlarm', {
      alarmName: `${restApi.restApiName}-4xx-errors`,
      alarmDescription: 'API Gateway 4XX 에러율이 높습니다',
      metric: restApi.metric('4XXError', {
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM,
      }),
      threshold: isProduction ? 50 : 20,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    clientErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // 5XX 에러 알람
    const serverErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway5XXErrorAlarm', {
      alarmName: `${restApi.restApiName}-5xx-errors`,
      alarmDescription: 'API Gateway 5XX 에러가 발생했습니다',
      metric: restApi.metric('5XXError', {
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM,
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    serverErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // 응답 시간 알람
    const latencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `${restApi.restApiName}-latency`,
      alarmDescription: 'API Gateway 응답시간이 높습니다',
      metric: restApi.metric('Latency', {
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.AVERAGE,
      }),
      threshold: isProduction ? 1000 : 2000, // ms
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    latencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  /**
   * DynamoDB 알람 생성
   */
  private createDynamoDBAlarms(table: dynamodb.Table, isProduction: boolean): void {
    // 읽기 스로틀링 알람
    const readThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBReadThrottleAlarm', {
      alarmName: `${table.tableName}-read-throttle`,
      alarmDescription: 'DynamoDB 읽기 스로틀링이 발생했습니다',
      metric: table.metric('ReadThrottles', {
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM,
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    readThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // 쓰기 스로틀링 알람
    const writeThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBWriteThrottleAlarm', {
      alarmName: `${table.tableName}-write-throttle`,
      alarmDescription: 'DynamoDB 쓰기 스로틀링이 발생했습니다',
      metric: table.metric('WriteThrottles', {
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM,
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    writeThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // 에러율 알람
    const errorAlarm = new cloudwatch.Alarm(this, 'DynamoDBErrorAlarm', {
      alarmName: `${table.tableName}-errors`,
      alarmDescription: 'DynamoDB 에러율이 높습니다',
      metric: table.metric('SystemErrors', {
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM,
      }),
      threshold: isProduction ? 5 : 2,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  /**
   * CloudWatch 대시보드 생성
   */
  private createDashboard(
    stage: string,
    restApi: apigateway.RestApi,
    table: dynamodb.Table,
    functions: lambda.Function[]
  ): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'TodoAppDashboard', {
      dashboardName: `hanbit-todo-dashboard-${stage}`,
    });

    // API Gateway 메트릭 위젯
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - 요청 수 및 에러',
        left: [
          restApi.metric('Count', {
            label: '총 요청',
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          restApi.metric('4XXError', {
            label: '4XX 에러',
            period: cdk.Duration.minutes(5),
          }),
          restApi.metric('5XXError', {
            label: '5XX 에러',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - 응답 시간',
        left: [
          restApi.metric('Latency', {
            label: '평균 응답시간',
            statistic: cloudwatch.Statistic.AVERAGE,
            period: cdk.Duration.minutes(5),
          }),
          restApi.metric('IntegrationLatency', {
            label: 'Lambda 통합 시간',
            statistic: cloudwatch.Statistic.AVERAGE,
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      })
    );

    // Lambda 함수 메트릭 위젯
    const functionMetrics = functions
      .map(func => [
        func.metricInvocations({
          label: `${func.functionName} 호출`,
          period: cdk.Duration.minutes(5),
        }),
        func.metricErrors({
          label: `${func.functionName} 에러`,
          period: cdk.Duration.minutes(5),
        }),
      ])
      .flat();

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda - 호출 수 및 에러',
        left: functionMetrics,
        width: 12,
      })
    );

    const durationMetrics = functions.map(func =>
      func.metricDuration({
        label: `${func.functionName} 응답시간`,
        statistic: cloudwatch.Statistic.AVERAGE,
        period: cdk.Duration.minutes(5),
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda - 응답 시간',
        left: durationMetrics,
        width: 12,
      })
    );

    // DynamoDB 메트릭 위젯
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - 용량 사용률',
        left: [
          table.metric('ConsumedReadCapacityUnits', {
            label: '읽기 용량 소비',
            period: cdk.Duration.minutes(5),
          }),
          table.metric('ConsumedWriteCapacityUnits', {
            label: '쓰기 용량 소비',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - 스로틀링 및 에러',
        left: [
          table.metric('ReadThrottles', {
            label: '읽기 스로틀',
            period: cdk.Duration.minutes(5),
          }),
          table.metric('WriteThrottles', {
            label: '쓰기 스로틀',
            period: cdk.Duration.minutes(5),
          }),
          table.metric('SystemErrors', {
            label: '시스템 에러',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 6,
      })
    );

    // X-Ray 서비스 맵 및 메트릭
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'X-Ray - 트레이스 및 응답 시간',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/X-Ray',
            metricName: 'TracesReceived',
            statistic: cloudwatch.Statistic.SUM,
            period: cdk.Duration.minutes(5),
            label: '수신된 트레이스',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/X-Ray',
            metricName: 'LatencyHigh',
            statistic: cloudwatch.Statistic.AVERAGE,
            period: cdk.Duration.minutes(5),
            label: '높은 지연시간',
          }),
        ],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'X-Ray - 에러 및 스로틀링',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/X-Ray',
            metricName: 'ErrorRate',
            statistic: cloudwatch.Statistic.AVERAGE,
            period: cdk.Duration.minutes(5),
            label: '에러율 (%)',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/X-Ray',
            metricName: 'ResponseTimeHigh',
            statistic: cloudwatch.Statistic.AVERAGE,
            period: cdk.Duration.minutes(5),
            label: '높은 응답시간 (%)',
          }),
        ],
        width: 6,
      })
    );

    return dashboard;
  }

  /**
   * X-Ray 관련 알람 생성
   */
  private createXRayAlarms(functions: lambda.Function[], isProduction: boolean): void {
    // 전체 서비스 에러율 알람
    const xrayErrorRateAlarm = new cloudwatch.Alarm(this, 'XRayServiceErrorRateAlarm', {
      alarmName: 'xray-service-error-rate',
      alarmDescription: 'X-Ray 서비스 에러율이 임계치를 초과했습니다',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/X-Ray',
        metricName: 'ErrorRate',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: cdk.Duration.minutes(5),
      }),
      threshold: isProduction ? 5 : 10, // 프로덕션에서는 더 엄격 (%)
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    xrayErrorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // 높은 응답시간 비율 알람
    const xrayHighLatencyAlarm = new cloudwatch.Alarm(this, 'XRayHighLatencyAlarm', {
      alarmName: 'xray-high-latency',
      alarmDescription: 'X-Ray 높은 응답시간 비율이 임계치를 초과했습니다',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/X-Ray',
        metricName: 'ResponseTimeHigh',
        statistic: cloudwatch.Statistic.AVERAGE,
        period: cdk.Duration.minutes(5),
      }),
      threshold: isProduction ? 10 : 20, // 프로덕션에서는 더 엄격 (%)
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    xrayHighLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  /**
   * 로그 그룹 설정
   */
  private configureLogGroups(functions: lambda.Function[], isProduction: boolean): void {
    const retentionDays = isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK;

    functions.forEach(func => {
      new logs.LogGroup(this, `${func.functionName}LogGroup`, {
        logGroupName: `/aws/lambda/${func.functionName}`,
        retention: retentionDays,
        removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    });
  }
}
