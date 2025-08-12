/**
 * 환경별 최적화가 적용된 향상된 Hanbit 스택
 * 환경별 리소스 격리, 태깅, 보안 정책이 통합된 CDK 스택
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import {
  Environment,
  IntegratedEnvironmentConfig,
  ResourceType,
  createEnvironmentConfig,
} from './environment-config';

/**
 * 향상된 스택 Props
 */
export interface EnhancedHanbitStackProps extends cdk.StackProps {
  /** 환경 타입 */
  environment: Environment;
  /** 프로젝트 이름 */
  projectName: string;
  /** 도메인 이름 (선택적) */
  domainName?: string;
}

/**
 * 환경별 최적화가 적용된 메인 스택
 */
export class EnhancedHanbitStack extends cdk.Stack {
  private readonly config: IntegratedEnvironmentConfig;
  private readonly kmsKey: kms.Key;
  private readonly auditBucket: s3.Bucket;
  private readonly trail?: cloudtrail.Trail;

  public readonly todoTable: dynamodb.Table;
  public readonly apiGateway: apigateway.RestApi;
  public readonly userPool: cognito.UserPool;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: EnhancedHanbitStackProps) {
    super(scope, id, props);

    // 환경별 설정 생성
    this.config = createEnvironmentConfig(
      props.environment,
      props.projectName,
      this.account,
      this.region
    );

    // 1. 보안 인프라 설정
    this.setupSecurityInfrastructure();

    // 2. 데이터베이스 생성
    this.todoTable = this.createDynamoDB();

    // 3. 인증 설정
    const authResources = this.createAuthentication();
    this.userPool = authResources.userPool;

    // 4. Lambda 함수 생성
    const lambdaFunctions = this.createLambdaFunctions();

    // 5. API Gateway 생성
    this.apiGateway = this.createApiGateway(lambdaFunctions, authResources);

    // 6. 모니터링 설정
    const monitoring = this.setupMonitoring(lambdaFunctions);
    this.alarmTopic = monitoring.alarmTopic;

    // 7. 스택 출력값 생성
    this.createOutputs();

    // 8. 전체 리소스에 태그 적용
    this.applyTags();
  }

  /**
   * 보안 인프라 설정
   */
  private setupSecurityInfrastructure(): void {
    // KMS 키 생성 (프로덕션/스테이징 환경)
    if (this.config.security.encryption.enforceAtRestEncryption) {
      this.kmsKey = new kms.Key(this, 'MasterKey', {
        alias: this.config.naming.generateResourceName('master', ResourceType.KMS_KEY),
        description: `Master encryption key for ${this.config.environment} environment`,
        enableKeyRotation: this.config.security.encryption.kmsKeyRotation,
        removalPolicy: this.config.dynamodb.removalPolicy,
      });
    }

    // 감사 로그용 S3 버킷
    if (this.config.security.audit.cloudTrailEnabled) {
      this.auditBucket = new s3.Bucket(this, 'AuditBucket', {
        bucketName: this.config.naming.generateResourceName('audit', ResourceType.S3_BUCKET),
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
        lifecycleRules: [
          {
            id: 'DeleteOldLogs',
            expiration: cdk.Duration.days(90),
            transitions: [
              {
                storageClass: s3.StorageClass.GLACIER,
                transitionAfter: cdk.Duration.days(30),
              },
            ],
          },
        ],
        removalPolicy: this.config.dynamodb.removalPolicy,
      });

      // CloudTrail 설정
      this.trail = new cloudtrail.Trail(this, 'AuditTrail', {
        trailName: this.config.naming.generateResourceName('audit', ResourceType.CLOUDWATCH_ALARM),
        bucket: this.auditBucket,
        encryptionKey: this.kmsKey,
        includeGlobalServiceEvents: true,
        isMultiRegionTrail: this.config.features.multiRegion,
        enableFileValidation: true,
      });
    }
  }

  /**
   * DynamoDB 테이블 생성
   */
  private createDynamoDB(): dynamodb.Table {
    const tableProps: dynamodb.TableProps = {
      tableName: this.config.naming.generateResourceName('todos', ResourceType.DYNAMODB),
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: this.config.dynamodb.billingMode,
      removalPolicy: this.config.dynamodb.removalPolicy,
      pointInTimeRecovery: this.config.dynamodb.backup.pitrEnabled,
      timeToLiveAttribute: this.config.dynamodb.ttl?.enabled
        ? this.config.dynamodb.ttl.attributeName
        : undefined,
    };

    // 프로비저닝 모드 설정
    if (this.config.dynamodb.billingMode === dynamodb.BillingMode.PROVISIONED) {
      tableProps.readCapacity = this.config.dynamodb.readCapacity;
      tableProps.writeCapacity = this.config.dynamodb.writeCapacity;
    }

    // 암호화 설정
    if (this.config.dynamodb.encryption.type === 'CUSTOMER_MANAGED' && this.kmsKey) {
      tableProps.encryption = dynamodb.TableEncryption.CUSTOMER_MANAGED;
      tableProps.encryptionKey = this.kmsKey;
    } else {
      tableProps.encryption = dynamodb.TableEncryption.AWS_MANAGED;
    }

    // 스트림 설정
    if (this.config.dynamodb.stream?.enabled) {
      tableProps.stream = this.config.dynamodb.stream.viewType;
    }

    const table = new dynamodb.Table(this, 'TodoTable', tableProps);

    // GSI 추가
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1-StatusPriority',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI2-SearchTitle',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 자동 스케일링 설정
    if (
      this.config.dynamodb.autoScaling?.enabled &&
      this.config.dynamodb.billingMode === dynamodb.BillingMode.PROVISIONED
    ) {
      const readScaling = table.autoScaleReadCapacity({
        minCapacity: this.config.dynamodb.autoScaling.minCapacity,
        maxCapacity: this.config.dynamodb.autoScaling.maxCapacity,
      });

      readScaling.scaleOnUtilization({
        targetUtilizationPercent: this.config.dynamodb.autoScaling.targetUtilization,
      });

      const writeScaling = table.autoScaleWriteCapacity({
        minCapacity: this.config.dynamodb.autoScaling.minCapacity,
        maxCapacity: this.config.dynamodb.autoScaling.maxCapacity,
      });

      writeScaling.scaleOnUtilization({
        targetUtilizationPercent: this.config.dynamodb.autoScaling.targetUtilization,
      });
    }

    return table;
  }

  /**
   * 인증 리소스 생성
   */
  private createAuthentication() {
    // User Pool 생성
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: this.config.naming.generateResourceName('users', ResourceType.COGNITO_POOL),
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: this.config.dynamodb.removalPolicy,
      mfa: this.config.security.iamPolicies.requireMFA
        ? cognito.Mfa.REQUIRED
        : cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
    });

    // User Pool Client
    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: `${this.config.naming.generateResourceName('web', ResourceType.COGNITO_POOL)}-client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      generateSecret: false,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      preventUserExistenceErrors: true,
    });

    // Identity Pool
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: this.config.naming.generateResourceName(
        'identity',
        ResourceType.COGNITO_POOL
      ),
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    return {
      userPool,
      userPoolClient,
      identityPool,
    };
  }

  /**
   * Lambda 함수 생성
   */
  private createLambdaFunctions() {
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      roleName: this.config.naming.generateResourceName('lambda-exec', ResourceType.IAM_ROLE),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // X-Ray 권한 추가
    if (this.config.monitoring.xray.enabled) {
      lambdaRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
    }

    // DynamoDB 권한
    this.todoTable.grantReadWriteData(lambdaRole);

    // KMS 권한 (필요한 경우)
    if (this.kmsKey) {
      this.kmsKey.grantEncryptDecrypt(lambdaRole);
    }

    const commonLambdaProps: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: this.config.lambda.memorySize,
      timeout: this.config.lambda.timeout,
      role: lambdaRole,
      tracing: this.config.lambda.tracing,
      environment: {
        ...this.config.lambda.environment,
        TABLE_NAME: this.todoTable.tableName,
        ENVIRONMENT: this.config.environment,
      },
      logRetention: this.config.lambda.logging.retention,
      reservedConcurrentExecutions: this.config.lambda.reservedConcurrentExecutions,
    };

    // Dead Letter Queue 설정 (프로덕션/스테이징)
    let deadLetterQueue;
    if (this.config.lambda.deadLetterQueue?.enabled) {
      const dlqTopic = new sns.Topic(this, 'DeadLetterTopic', {
        topicName: this.config.naming.generateResourceName('dlq', ResourceType.SNS_TOPIC),
      });

      deadLetterQueue = {
        queue: dlqTopic,
        maxReceiveCount: this.config.lambda.deadLetterQueue.maxRetryCount,
      };
    }

    // Lambda 함수들 생성
    const functions: Record<string, lambda.Function> = {};

    const handlers = [
      { name: 'create-todo', handler: 'handlers/todos/create.handler' },
      { name: 'list-todos', handler: 'handlers/todos/list.handler' },
      { name: 'update-todo', handler: 'handlers/todos/update.handler' },
      { name: 'delete-todo', handler: 'handlers/todos/delete.handler' },
      { name: 'auth-login', handler: 'handlers/auth/login.handler' },
      { name: 'auth-refresh', handler: 'handlers/auth/refresh.handler' },
      { name: 'auth-guest', handler: 'handlers/auth/guest.handler' },
    ];

    for (const { name, handler } of handlers) {
      const fn = new lambda.Function(this, `${name}Function`, {
        ...(commonLambdaProps as lambda.FunctionProps),
        functionName: this.config.naming.generateResourceName(name, ResourceType.LAMBDA),
        code: lambda.Code.fromAsset('../../lambda'),
        handler,
        deadLetterQueue,
      });

      // Provisioned Concurrency 설정 (프로덕션)
      if (this.config.lambda.provisionedConcurrentExecutions) {
        new lambda.Alias(this, `${name}Alias`, {
          aliasName: 'live',
          version: fn.currentVersion,
          provisionedConcurrentExecutions: this.config.lambda.provisionedConcurrentExecutions,
        });
      }

      functions[name] = fn;
    }

    return functions;
  }

  /**
   * API Gateway 생성
   */
  private createApiGateway(
    lambdaFunctions: Record<string, lambda.Function>,
    authResources: {
      userPool: cognito.UserPool;
      userPoolClient: cognito.UserPoolClient;
      identityPool: cognito.CfnIdentityPool;
    }
  ): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'TodoApi', {
      restApiName: this.config.naming.generateResourceName('api', ResourceType.API_GATEWAY),
      description: `Todo API for ${this.config.environment} environment`,
      deployOptions: {
        stageName: this.config.apiGateway.stageName,
        tracingEnabled: this.config.monitoring.xray.enabled,
        loggingLevel:
          this.config.apiGateway.logging.level === 'OFF'
            ? undefined
            : apigateway.MethodLoggingLevel[this.config.apiGateway.logging.level],
        dataTraceEnabled: this.config.apiGateway.logging.dataTrace,
        metricsEnabled: this.config.apiGateway.logging.metricsEnabled,
        throttle: {
          rateLimit: this.config.apiGateway.throttling.rateLimit,
          burstLimit: this.config.apiGateway.throttling.burstLimit,
        },
      },
      defaultCorsPreflightOptions: {
        allowOrigins: this.config.apiGateway.cors.allowOrigins,
        allowMethods: this.config.apiGateway.cors.allowMethods,
        allowHeaders: this.config.apiGateway.cors.allowHeaders,
        allowCredentials: true,
        maxAge: this.config.apiGateway.cors.maxAge,
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [authResources.userPool],
      authorizerName: this.config.naming.generateResourceName(
        'authorizer',
        ResourceType.API_GATEWAY
      ),
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // API 키 설정 (프로덕션)
    let apiKey;
    if (this.config.apiGateway.apiKey?.required) {
      apiKey = api.addApiKey('ApiKey', {
        apiKeyName: this.config.naming.generateResourceName('key', ResourceType.API_GATEWAY),
        description: `API key for ${this.config.environment} environment`,
      });

      const usagePlan = api.addUsagePlan('UsagePlan', {
        name: this.config.naming.generateResourceName('usage', ResourceType.API_GATEWAY),
        throttle: {
          rateLimit: this.config.apiGateway.throttling.rateLimit,
          burstLimit: this.config.apiGateway.throttling.burstLimit,
        },
        quota: this.config.apiGateway.apiKey.quota
          ? {
              limit: this.config.apiGateway.apiKey.quota.limit,
              period: apigateway.Period[this.config.apiGateway.apiKey.quota.period],
            }
          : undefined,
      });

      usagePlan.addApiKey(apiKey);
      usagePlan.addApiStage({
        api,
        stage: api.deploymentStage,
      });
    }

    // API 라우트 설정
    const todosResource = api.root.addResource('todos');
    const todoResource = todosResource.addResource('{id}');

    // TODO 엔드포인트 (인증 필요)
    todosResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(lambdaFunctions['list-todos']),
      { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO }
    );

    todosResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(lambdaFunctions['create-todo']),
      { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO }
    );

    todoResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(lambdaFunctions['update-todo']),
      { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO }
    );

    todoResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(lambdaFunctions['delete-todo']),
      { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO }
    );

    // 인증 엔드포인트 (공개)
    const authResource = api.root.addResource('auth');

    authResource
      .addResource('login')
      .addMethod('POST', new apigateway.LambdaIntegration(lambdaFunctions['auth-login']));

    authResource
      .addResource('refresh')
      .addMethod('POST', new apigateway.LambdaIntegration(lambdaFunctions['auth-refresh']));

    authResource
      .addResource('guest')
      .addMethod('POST', new apigateway.LambdaIntegration(lambdaFunctions['auth-guest']));

    // 캐싱 설정 (프로덕션/스테이징)
    if (this.config.apiGateway.caching?.enabled) {
      api.deploymentStage.cacheClusterEnabled = true;
      api.deploymentStage.cacheClusterSize = this.config.apiGateway.caching.clusterSize;
      api.deploymentStage.cacheTtl = cdk.Duration.seconds(
        this.config.apiGateway.caching.ttlSeconds
      );
      api.deploymentStage.cachingEnabled = true;
    }

    return api;
  }

  /**
   * 모니터링 설정
   */
  private setupMonitoring(lambdaFunctions: Record<string, lambda.Function>) {
    // SNS 토픽 생성
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: this.config.naming.generateResourceName('alarms', ResourceType.SNS_TOPIC),
      displayName: `Alarms for ${this.config.environment} environment`,
    });

    // 이메일 구독 추가
    if (this.config.monitoring.alarms.notificationChannels.email) {
      for (const email of this.config.monitoring.alarms.notificationChannels.email) {
        alarmTopic.addSubscription(new snsSubscriptions.EmailSubscription(email));
      }
    }

    // CloudWatch 대시보드
    if (this.config.monitoring.dashboard.enabled) {
      const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
        dashboardName: this.config.naming.generateResourceName(
          'metrics',
          ResourceType.CLOUDWATCH_ALARM
        ),
        defaultInterval: cdk.Duration.hours(3),
      });

      // Lambda 메트릭 위젯
      for (const [name, fn] of Object.entries(lambdaFunctions)) {
        dashboard.addWidgets(
          new cloudwatch.GraphWidget({
            title: `${name} Performance`,
            left: [fn.metricInvocations(), fn.metricErrors(), fn.metricDuration()],
            width: 8,
            height: 6,
          })
        );
      }

      // DynamoDB 메트릭 위젯
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'DynamoDB Performance',
          left: [
            this.todoTable.metricConsumedReadCapacityUnits(),
            this.todoTable.metricConsumedWriteCapacityUnits(),
          ],
          right: [
            this.todoTable.metricSystemErrorsForOperations(),
            this.todoTable.metricUserErrors(),
          ],
          width: 12,
          height: 6,
        })
      );

      // API Gateway 메트릭 위젯
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'API Gateway Performance',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/ApiGateway',
              metricName: 'Count',
              dimensionsMap: {
                ApiName: this.apiGateway.restApiName,
              },
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/ApiGateway',
              metricName: '4XXError',
              dimensionsMap: {
                ApiName: this.apiGateway.restApiName,
              },
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/ApiGateway',
              metricName: '5XXError',
              dimensionsMap: {
                ApiName: this.apiGateway.restApiName,
              },
            }),
          ],
          width: 12,
          height: 6,
        })
      );
    }

    // 알람 생성
    if (this.config.monitoring.alarms.enabled) {
      // Lambda 에러 알람
      for (const [name, fn] of Object.entries(lambdaFunctions)) {
        new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
          alarmName: this.config.naming.generateResourceName(
            `${name}-errors`,
            ResourceType.CLOUDWATCH_ALARM
          ),
          metric: fn.metricErrors(),
          threshold: 5,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          alarmDescription: `High error rate for ${name} function`,
        }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));
      }

      // DynamoDB 스로틀 알람
      new cloudwatch.Alarm(this, 'DynamoDBThrottleAlarm', {
        alarmName: this.config.naming.generateResourceName(
          'dynamodb-throttle',
          ResourceType.CLOUDWATCH_ALARM
        ),
        metric: this.todoTable.metricSystemErrorsForOperations(),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'DynamoDB throttling detected',
      }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));

      // API Gateway 4XX 에러 알람
      new cloudwatch.Alarm(this, 'ApiGateway4xxAlarm', {
        alarmName: this.config.naming.generateResourceName(
          'api-4xx',
          ResourceType.CLOUDWATCH_ALARM
        ),
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: {
            ApiName: this.apiGateway.restApiName,
          },
          statistic: 'Sum',
        }),
        threshold: 10,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'High 4XX error rate on API Gateway',
      }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic));
    }

    // 비용 모니터링 (Budget 알람은 별도 구현 필요)
    if (this.config.monitoring.costMonitoring.enabled) {
      // AWS Budgets API를 통한 구현이 필요함
      // 여기서는 태그만 추가
      cdk.Tags.of(this).add('BudgetTracking', 'Enabled');
    }

    return {
      alarmTopic,
    };
  }

  /**
   * 스택 출력값 생성
   */
  private createOutputs(): void {
    // API 엔드포인트
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.apiGateway.url,
      description: `API Gateway endpoint for ${this.config.environment}`,
      exportName: this.config.naming.generateExportName('ApiEndpoint'),
    });

    // DynamoDB 테이블 이름
    new cdk.CfnOutput(this, 'TableName', {
      value: this.todoTable.tableName,
      description: `DynamoDB table name for ${this.config.environment}`,
      exportName: this.config.naming.generateExportName('TableName'),
    });

    // User Pool ID
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: `Cognito User Pool ID for ${this.config.environment}`,
      exportName: this.config.naming.generateExportName('UserPoolId'),
    });

    // 환경 정보
    new cdk.CfnOutput(this, 'Environment', {
      value: this.config.environment,
      description: 'Deployment environment',
      exportName: this.config.naming.generateExportName('Environment'),
    });

    // 리전 정보
    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
      exportName: this.config.naming.generateExportName('Region'),
    });
  }

  /**
   * 태그 적용
   */
  private applyTags(): void {
    // 필수 태그 적용
    for (const [key, value] of Object.entries(this.config.tagging.requiredTags)) {
      cdk.Tags.of(this).add(key, value);
    }

    // 비용 할당 태그 적용
    for (const [key, value] of Object.entries(this.config.tagging.costAllocationTags)) {
      cdk.Tags.of(this).add(key, value);
    }

    // 보안 태그 적용
    for (const [key, value] of Object.entries(this.config.tagging.securityTags)) {
      cdk.Tags.of(this).add(key, value);
    }

    // 운영 태그 적용
    for (const [key, value] of Object.entries(this.config.tagging.operationalTags)) {
      cdk.Tags.of(this).add(key, value);
    }

    // 선택적 태그 적용
    if (this.config.tagging.optionalTags) {
      for (const [key, value] of Object.entries(this.config.tagging.optionalTags)) {
        cdk.Tags.of(this).add(key, value);
      }
    }
  }
}
