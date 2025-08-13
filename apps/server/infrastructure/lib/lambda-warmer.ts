import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { resolve } from 'path';

export interface LambdaWarmerProps {
  targetFunctions: lambda.Function[];
  warmerSchedule?: events.Schedule;
  concurrency?: number;
  enableWarming?: boolean;
}

/**
 * Lambda 콜드 스타트 방지를 위한 Warmer 구성
 *
 * 주요 기능:
 * - 스케줄된 Lambda 함수 호출로 warm 상태 유지
 * - 환경별 다른 warmer 전략 적용
 * - 비용 최적화를 고려한 선택적 warming
 * - 성능 메트릭 수집
 */
export class LambdaWarmer extends Construct {
  public readonly warmerFunction: lambda.Function;
  public readonly warmerRule: events.Rule;

  constructor(scope: Construct, id: string, props: LambdaWarmerProps) {
    super(scope, id);

    const {
      targetFunctions,
      warmerSchedule = events.Schedule.rate(cdk.Duration.minutes(5)),
      concurrency = 1,
      enableWarming = this.shouldEnableWarming(),
    } = props;

    if (!enableWarming) {
      // 개발 환경에서는 warmer 비활성화
      return;
    }

    // Warmer Lambda 함수 생성
    this.warmerFunction = this.createWarmerFunction(targetFunctions, concurrency);

    // CloudWatch Events 규칙 생성
    this.warmerRule = this.createWarmerSchedule(warmerSchedule);

    // 권한 설정
    this.setupPermissions(targetFunctions);

    // 태그 및 메트릭 설정
    this.setupMonitoring();
  }

  /**
   * 환경별 warmer 활성화 여부 결정
   */
  private shouldEnableWarming(): boolean {
    const environment = process.env.NODE_ENV || 'development';

    // 프로덕션과 테스트 환경에서만 warmer 활성화
    return environment === 'production' || environment === 'test';
  }

  /**
   * Warmer Lambda 함수 생성
   */
  private createWarmerFunction(
    targetFunctions: lambda.Function[],
    concurrency: number
  ): lambda.Function {
    const warmerFunction = new lambda.Function(this, 'WarmerFunction', {
      functionName: `hanbit-lambda-warmer-${process.env.NODE_ENV || 'dev'}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'warmer.handler',
      code: lambda.Code.fromAsset(resolve(__dirname, '../lambda/warmer')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128, // 최소 메모리 사용
      architecture: lambda.Architecture.ARM_64, // 비용 절감
      environment: {
        TARGET_FUNCTIONS: JSON.stringify(targetFunctions.map(fn => fn.functionArn)),
        CONCURRENCY: concurrency.toString(),
        LOG_LEVEL: 'INFO',
      },
      description: 'Lambda warmer to prevent cold starts',
      tracing: lambda.Tracing.PASS_THROUGH,
    });

    return warmerFunction;
  }

  /**
   * Warmer 스케줄 생성
   */
  private createWarmerSchedule(schedule: events.Schedule): events.Rule {
    const rule = new events.Rule(this, 'WarmerSchedule', {
      ruleName: `hanbit-lambda-warmer-schedule-${process.env.NODE_ENV || 'dev'}`,
      description: 'Schedule for Lambda warmer',
      schedule,
      enabled: true,
    });

    // Warmer 함수를 타겟으로 추가
    rule.addTarget(
      new targets.LambdaFunction(this.warmerFunction, {
        event: events.RuleTargetInput.fromObject({
          source: 'lambda-warmer',
          action: 'warm',
          timestamp: events.EventField.fromPath('$.time'),
        }),
      })
    );

    return rule;
  }

  /**
   * 권한 설정
   */
  private setupPermissions(targetFunctions: lambda.Function[]): void {
    // Warmer 함수에 대상 Lambda 함수 호출 권한 부여
    targetFunctions.forEach(targetFunction => {
      this.warmerFunction.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [targetFunction.functionArn],
        })
      );
    });

    // CloudWatch Logs 권한
    this.warmerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`],
      })
    );
  }

  /**
   * 모니터링 설정
   */
  private setupMonitoring(): void {
    // 태그 추가
    cdk.Tags.of(this.warmerFunction).add('Component', 'LambdaWarmer');
    cdk.Tags.of(this.warmerFunction).add('Purpose', 'ColdStartPrevention');
    cdk.Tags.of(this.warmerFunction).add('Environment', process.env.NODE_ENV || 'dev');

    // 에러 알람 (선택적)
    if (process.env.NODE_ENV === 'production') {
      const errorAlarm = this.warmerFunction
        .metricErrors({
          period: cdk.Duration.minutes(15),
        })
        .createAlarm(this, 'WarmerErrorAlarm', {
          threshold: 1,
          evaluationPeriods: 1,
          alarmDescription: 'Lambda warmer function errors',
        });

      cdk.Tags.of(errorAlarm).add('AlertType', 'WarmerFailure');
    }
  }

  /**
   * 환경별 warmer 설정 팩토리
   */
  static forEnvironment(
    scope: Construct,
    id: string,
    targetFunctions: lambda.Function[],
    environment: 'production' | 'test' | 'development'
  ): LambdaWarmer | undefined {
    switch (environment) {
      case 'production':
        return new LambdaWarmer(scope, id, {
          targetFunctions,
          warmerSchedule: events.Schedule.rate(cdk.Duration.minutes(3)), // 빈번한 warming
          concurrency: 2,
          enableWarming: true,
        });

      case 'test':
        return new LambdaWarmer(scope, id, {
          targetFunctions,
          warmerSchedule: events.Schedule.rate(cdk.Duration.minutes(10)), // 보통 warming
          concurrency: 1,
          enableWarming: true,
        });

      case 'development':
        // 개발 환경에서는 warmer 비활성화 (비용 절감)
        return undefined;

      default:
        return undefined;
    }
  }
}

/**
 * Critical Lambda 함수들에 대한 프리미엄 warmer
 */
export class CriticalLambdaWarmer extends LambdaWarmer {
  constructor(scope: Construct, id: string, criticalFunctions: lambda.Function[]) {
    super(scope, id, {
      targetFunctions: criticalFunctions,
      warmerSchedule: events.Schedule.rate(cdk.Duration.minutes(2)), // 매우 빈번한 warming
      concurrency: 3, // 높은 동시성
      enableWarming: true,
    });

    // Critical 함수들에 대한 추가 설정
    criticalFunctions.forEach(func => {
      // Provisioned Concurrency 설정
      const alias = func.addAlias('live');
      alias.addAutoScaling({
        minCapacity: 1,
        maxCapacity: 10,
        targetUtilization: 0.7,
      });

      // 추가 모니터링
      cdk.Tags.of(func).add('CriticalFunction', 'true');
      cdk.Tags.of(func).add('WarmerType', 'critical');
    });
  }
}
