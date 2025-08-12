import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { EnvironmentConfig } from '../../config/environment';
import { resolve } from 'path';

export interface OptimizedLambdaStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  todoTable: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  identityPool: cognito.CfnIdentityPool;
  environment?: Record<string, string>;
}

/**
 * 최적화된 Lambda 스택
 * 환경별로 다른 메모리, 타임아웃, 동시 실행 제한을 적용
 */
export class OptimizedLambdaStack extends BaseStack {
  public readonly todoHandlers: Record<string, lambda.Function>;
  public readonly authHandlers: Record<string, lambda.Function>;
  private readonly lambdaRole: iam.Role;

  constructor(scope: Construct, id: string, props: OptimizedLambdaStackProps) {
    super(scope, id, props);

    const { todoTable, userPool, userPoolClient, identityPool, environment = {} } = props;

    // Lambda 실행 역할 생성
    this.lambdaRole = this.createLambdaExecutionRole();

    // Lambda 레이어 생성 (공통 의존성)
    const commonLayer = this.createCommonLayer();

    // 환경별 Lambda 설정
    const lambdaConfig = this.getLambdaConfiguration();

    // 공통 Lambda 속성
    const commonProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X, // 최신 런타임 사용
      architecture: this.selectByEnvironment(
        lambda.Architecture.ARM_64, // 프로덕션: ARM for cost savings
        lambda.Architecture.X86_64, // 테스트: x86 for compatibility
        lambda.Architecture.ARM_64 // 개발: ARM for cost savings
      ),
      timeout: cdk.Duration.seconds(lambdaConfig.timeout),
      memorySize: lambdaConfig.memorySize,
      tracing: this.selectByEnvironment(
        lambda.Tracing.ACTIVE,
        lambda.Tracing.ACTIVE,
        lambda.Tracing.PASS_THROUGH // 개발: X-Ray 비용 절감
      ),
      environment: {
        ...this.getCommonEnvironmentVariables(todoTable, userPool, userPoolClient, identityPool),
        ...environment,
      },
      logRetention: logs.RetentionDays.forValue(lambdaConfig.logRetentionDays),
      layers: [commonLayer],
      role: this.lambdaRole,
    };

    // Lambda 함수 생성
    this.todoHandlers = this.createTodoHandlers(commonProps, todoTable);
    this.authHandlers = this.createAuthHandlers(commonProps);

    // 환경별 추가 설정
    this.applyEnvironmentSpecificSettings();

    // 모니터링 설정
    this.setupMonitoring();

    // 비용 최적화 설정
    this.applyCostOptimizations();

    // 출력값 생성
    this.createOutputs();
  }

  /**
   * Lambda 실행 역할 생성
   */
  private createLambdaExecutionRole(): iam.Role {
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: this.resourceName('hanbit-lambda-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Lambda execution role for ${this.config.name} environment`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // 환경별 추가 정책
    if (this.isProd || this.isTest) {
      role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
    }

    // CloudWatch Logs 권한
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`arn:aws:logs:${this.region}:${this.account}:*`],
      })
    );

    // Secrets Manager 권한 (프로덕션/테스트)
    if (this.isProd || this.isTest) {
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
          resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:hanbit-*`],
        })
      );
    }

    return role;
  }

  /**
   * 공통 레이어 생성
   */
  private createCommonLayer(): lambda.LayerVersion {
    return new lambda.LayerVersion(this, 'CommonLayer', {
      layerVersionName: this.resourceName('hanbit-common-layer'),
      code: lambda.Code.fromAsset(resolve(__dirname, '../../lambda/layers/common')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      compatibleArchitectures: [lambda.Architecture.ARM_64, lambda.Architecture.X86_64],
      description: `Common dependencies for ${this.config.name} environment`,
      removalPolicy: this.getRemovalPolicy(),
    });
  }

  /**
   * 환경별 Lambda 설정 가져오기
   */
  private getLambdaConfiguration() {
    return {
      memorySize: this.selectByEnvironment(1024, 512, 256), // MB
      timeout: this.selectByEnvironment(30, 60, 30), // seconds
      logRetentionDays: this.selectByEnvironment(30, 14, 7), // days
      reservedConcurrency: this.selectByEnvironment(100, 50, undefined), // concurrent executions
      provisionedConcurrency: this.selectByEnvironment(2, undefined, undefined), // warm instances
    };
  }

  /**
   * 공통 환경 변수 생성
   */
  private getCommonEnvironmentVariables(
    todoTable: dynamodb.Table,
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient,
    identityPool: cognito.CfnIdentityPool
  ): Record<string, string> {
    return {
      DYNAMODB_TABLE_NAME: todoTable.tableName,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      COGNITO_IDENTITY_POOL_ID: identityPool.ref,
      AWS_REGION: this.region,
      NODE_ENV: this.config.name,
      LOG_LEVEL: this.config.lambda.environment.LOG_LEVEL,
      ENABLE_CORS: this.config.lambda.environment.ENABLE_CORS,
      ENABLE_DEBUG: this.config.lambda.environment.ENABLE_DEBUG,
      POWERTOOLS_SERVICE_NAME: 'hanbit-todo',
      POWERTOOLS_METRICS_NAMESPACE: 'HanbitTodo',
      POWERTOOLS_LOG_LEVEL: this.selectByEnvironment('ERROR', 'INFO', 'DEBUG'),
    };
  }

  /**
   * TODO 핸들러 생성
   */
  private createTodoHandlers(
    commonProps: Partial<lambda.FunctionProps>,
    todoTable: dynamodb.Table
  ): Record<string, lambda.Function> {
    const handlers: Record<string, lambda.Function> = {};
    const lambdaCodePath = resolve(__dirname, '../../lambda');

    const todoOperations = [
      { name: 'create', handler: 'handlers/todos/create.handler', description: 'Create new TODO' },
      { name: 'list', handler: 'handlers/todos/list.handler', description: 'List TODOs' },
      { name: 'update', handler: 'handlers/todos/update.handler', description: 'Update TODO' },
      { name: 'delete', handler: 'handlers/todos/delete.handler', description: 'Delete TODO' },
    ];

    todoOperations.forEach(op => {
      const func = new lambda.Function(this, `${op.name}TodoHandler`, {
        ...commonProps,
        functionName: this.resourceName(`hanbit-todo-${op.name}`),
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: op.handler,
        description: `${op.description} - ${this.config.name}`,
        reservedConcurrentExecutions: this.selectByEnvironment(
          50, // 프로덕션: 예약된 동시 실행
          25, // 테스트: 제한된 동시 실행
          undefined // 개발: 제한 없음
        ),
      } as lambda.FunctionProps);

      // DynamoDB 권한 부여
      todoTable.grantReadWriteData(func);

      handlers[op.name] = func;
    });

    return handlers;
  }

  /**
   * 인증 핸들러 생성
   */
  private createAuthHandlers(
    commonProps: Partial<lambda.FunctionProps>
  ): Record<string, lambda.Function> {
    const handlers: Record<string, lambda.Function> = {};
    const lambdaCodePath = resolve(__dirname, '../../lambda');

    const authOperations = [
      { name: 'login', handler: 'handlers/auth/login.handler', description: 'User login' },
      { name: 'refresh', handler: 'handlers/auth/refresh.handler', description: 'Token refresh' },
      { name: 'guest', handler: 'auth/guest-auth.handler', description: 'Guest authentication' },
    ];

    authOperations.forEach(op => {
      const func = new lambda.Function(this, `${op.name}AuthHandler`, {
        ...commonProps,
        functionName: this.resourceName(`hanbit-auth-${op.name}`),
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: op.handler,
        description: `${op.description} - ${this.config.name}`,
        // 게스트 인증은 더 적은 리소스 사용
        memorySize:
          op.name === 'guest' ? this.selectByEnvironment(256, 256, 128) : commonProps.memorySize,
        timeout: op.name === 'guest' ? cdk.Duration.seconds(15) : commonProps.timeout,
      } as lambda.FunctionProps);

      // Cognito Identity Pool 권한 (게스트 인증용)
      if (op.name === 'guest') {
        func.addToRolePolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cognito-identity:GetId', 'cognito-identity:GetCredentialsForIdentity'],
            resources: ['*'],
          })
        );
      }

      handlers[op.name] = func;
    });

    return handlers;
  }

  /**
   * 환경별 특수 설정 적용
   */
  private applyEnvironmentSpecificSettings(): void {
    const allHandlers = [...Object.values(this.todoHandlers), ...Object.values(this.authHandlers)];

    if (this.isProd) {
      // 프로덕션: 프로비전드 동시성 설정
      const criticalHandlers = [this.todoHandlers.list, this.authHandlers.login];
      criticalHandlers.forEach(handler => {
        new lambda.Alias(handler.node.scope as Construct, `${handler.node.id}Alias`, {
          aliasName: 'live',
          version: handler.currentVersion,
          provisionedConcurrentExecutions: 2,
        });
      });

      // 프로덕션: 데드레터 큐 설정
      allHandlers.forEach(handler => {
        handler.configureAsyncInvoke({
          retryAttempts: 2,
          maxEventAge: cdk.Duration.hours(1),
        });
      });
    }

    if (this.isTest) {
      // 테스트: 동시 실행 제한
      allHandlers.forEach(handler => {
        const cfnFunction = handler.node.defaultChild as lambda.CfnFunction;
        cfnFunction.reservedConcurrentExecutions = 10;
      });
    }

    // 모든 환경: Lambda Insights 활성화 (프로덕션/테스트만)
    if (this.isProd || this.isTest) {
      allHandlers.forEach(handler => {
        const insightsLayer = lambda.LayerVersion.fromLayerVersionArn(
          handler,
          'LambdaInsights',
          `arn:aws:lambda:${this.region}:580247275435:layer:LambdaInsightsExtension-Arm64:2`
        );
        handler.addLayers(insightsLayer);
      });
    }
  }

  /**
   * 모니터링 설정
   */
  private setupMonitoring(): void {
    const allHandlers = [...Object.values(this.todoHandlers), ...Object.values(this.authHandlers)];

    allHandlers.forEach(handler => {
      // 에러율 알람
      new cloudwatch.Alarm(this, `${handler.node.id}ErrorAlarm`, {
        metric: handler.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: this.selectByEnvironment(5, 10, 20),
        evaluationPeriods: 2,
        alarmDescription: `Error rate alarm for ${handler.functionName}`,
      });

      // 스로틀링 알람 (프로덕션/테스트만)
      if (this.isProd || this.isTest) {
        new cloudwatch.Alarm(this, `${handler.node.id}ThrottleAlarm`, {
          metric: handler.metricThrottles({
            period: cdk.Duration.minutes(5),
          }),
          threshold: this.selectByEnvironment(5, 10, 0),
          evaluationPeriods: 1,
          alarmDescription: `Throttle alarm for ${handler.functionName}`,
        });
      }

      // 지속 시간 알람 (프로덕션만)
      if (this.isProd) {
        new cloudwatch.Alarm(this, `${handler.node.id}DurationAlarm`, {
          metric: handler.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: 'p99',
          }),
          threshold: 10000, // 10 seconds
          evaluationPeriods: 2,
          alarmDescription: `Duration alarm for ${handler.functionName}`,
        });
      }
    });
  }

  /**
   * 비용 최적화 설정
   */
  private applyCostOptimizations(): void {
    const allHandlers = [...Object.values(this.todoHandlers), ...Object.values(this.authHandlers)];

    if (this.isDev) {
      // 개발: 최소 리소스 사용
      allHandlers.forEach(handler => {
        cdk.Tags.of(handler).add('CostOptimization', 'aggressive');
        cdk.Tags.of(handler).add('AutoStop', 'enabled');
      });
    }

    if (this.isTest) {
      // 테스트: 균형잡힌 리소스 사용
      allHandlers.forEach(handler => {
        cdk.Tags.of(handler).add('CostOptimization', 'balanced');
      });
    }

    if (this.isProd) {
      // 프로덕션: Compute Savings Plan 적용 가능
      allHandlers.forEach(handler => {
        cdk.Tags.of(handler).add('CostOptimization', 'performance-first');
        cdk.Tags.of(handler).add('SavingsPlan', 'eligible');
      });
    }
  }

  /**
   * 출력값 생성
   */
  private createOutputs(): void {
    // TODO 핸들러 ARN
    Object.entries(this.todoHandlers).forEach(([name, handler]) => {
      this.createOutput(`TodoHandler${name}Arn`, handler.functionArn, `${name} handler ARN`);
    });

    // 인증 핸들러 ARN
    Object.entries(this.authHandlers).forEach(([name, handler]) => {
      this.createOutput(`AuthHandler${name}Arn`, handler.functionArn, `${name} auth handler ARN`);
    });

    // 메트릭 정보
    this.createOutput(
      'LambdaArchitecture',
      this.selectByEnvironment('ARM64', 'X86_64', 'ARM64'),
      'Lambda architecture'
    );

    this.createOutput(
      'LambdaMemorySize',
      this.selectByEnvironment('1024', '512', '256'),
      'Lambda memory size (MB)'
    );
  }
}
