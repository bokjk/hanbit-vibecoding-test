import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface DeploymentHistoryProps {
  /** 환경 설정 */
  environmentConfig: EnvironmentConfig;
}

/**
 * 배포 히스토리 관리 시스템
 *
 * 기능:
 * - 배포 히스토리 저장 및 조회
 * - 배포 메트릭 분석
 * - 롤백 지점 관리
 */
export class DeploymentHistoryConstruct extends Construct {
  public readonly deploymentHistoryTable: dynamodb.Table;
  public readonly deploymentHistoryFunction: lambda.Function;
  public readonly deploymentStatsFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: DeploymentHistoryProps) {
    super(scope, id);

    const { environmentConfig } = props;

    // 배포 히스토리 DynamoDB 테이블
    this.deploymentHistoryTable = new dynamodb.Table(this, 'DeploymentHistoryTable', {
      tableName: `deployment-history-${environmentConfig.name}`,
      partitionKey: {
        name: 'deploymentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      // 환경별 다른 설정
      billingMode:
        environmentConfig.name === 'prod'
          ? dynamodb.BillingMode.PROVISIONED
          : dynamodb.BillingMode.PAY_PER_REQUEST,

      // 프로덕션 환경만 백업 활성화
      pointInTimeRecovery: environmentConfig.name === 'prod',

      // TTL 설정 (90일 후 자동 삭제)
      timeToLiveAttribute: 'ttl',

      // GSI - 환경별 조회용
      globalSecondaryIndexes: [
        {
          indexName: 'EnvironmentIndex',
          partitionKey: {
            name: 'environment',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'timestamp',
            type: dynamodb.AttributeType.STRING,
          },
          projectionType: dynamodb.ProjectionType.ALL,
        },
        {
          indexName: 'StatusIndex',
          partitionKey: {
            name: 'status',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'timestamp',
            type: dynamodb.AttributeType.STRING,
          },
          projectionType: dynamodb.ProjectionType.ALL,
        },
      ],

      removalPolicy:
        environmentConfig.name === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // 프로덕션 환경의 경우 읽기/쓰기 용량 설정
    if (environmentConfig.name === 'prod') {
      this.deploymentHistoryTable
        .autoScaleReadCapacity({
          minCapacity: 5,
          maxCapacity: 100,
        })
        .scaleOnUtilization({
          targetUtilizationPercent: 70,
        });

      this.deploymentHistoryTable
        .autoScaleWriteCapacity({
          minCapacity: 5,
          maxCapacity: 100,
        })
        .scaleOnUtilization({
          targetUtilizationPercent: 70,
        });
    }

    // 배포 히스토리 관리 Lambda 함수
    this.deploymentHistoryFunction = new lambda.Function(this, 'DeploymentHistoryFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deployment-history.handler',
      code: lambda.Code.fromAsset('lambda/deployment'),
      environment: {
        DEPLOYMENT_HISTORY_TABLE: this.deploymentHistoryTable.tableName,
        ENVIRONMENT: environmentConfig.name,
      },
      timeout: cdk.Duration.seconds(30),
      description: `배포 히스토리 관리 함수 (${environmentConfig.name})`,
    });

    // 배포 통계 Lambda 함수
    this.deploymentStatsFunction = new lambda.Function(this, 'DeploymentStatsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'deployment-stats.handler',
      code: lambda.Code.fromAsset('lambda/deployment'),
      environment: {
        DEPLOYMENT_HISTORY_TABLE: this.deploymentHistoryTable.tableName,
        ENVIRONMENT: environmentConfig.name,
      },
      timeout: cdk.Duration.minutes(2),
      description: `배포 통계 분석 함수 (${environmentConfig.name})`,
    });

    // DynamoDB 권한 부여
    this.deploymentHistoryTable.grantReadWriteData(this.deploymentHistoryFunction);
    this.deploymentHistoryTable.grantReadData(this.deploymentStatsFunction);

    // Lambda 함수에 추가 권한 부여
    this.deploymentHistoryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:ListStackResources',
        ],
        resources: [
          `arn:aws:cloudformation:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stack/HanbitTodoStack-${environmentConfig.name}/*`,
        ],
      })
    );
  }

  /**
   * API Gateway 통합 생성
   */
  public createApiIntegration(api: apigateway.RestApi): void {
    const deploymentResource = api.root.addResource('deployment');

    // 배포 히스토리 조회 API
    const historyResource = deploymentResource.addResource('history');
    historyResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.deploymentHistoryFunction),
      {
        requestParameters: {
          'method.request.querystring.limit': false,
          'method.request.querystring.status': false,
          'method.request.querystring.from': false,
          'method.request.querystring.to': false,
        },
      }
    );

    // 배포 통계 API
    const statsResource = deploymentResource.addResource('stats');
    statsResource.addMethod('GET', new apigateway.LambdaIntegration(this.deploymentStatsFunction));

    // 특정 배포 정보 조회 API
    const deploymentIdResource = historyResource.addResource('{deploymentId}');
    deploymentIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.deploymentHistoryFunction)
    );
  }
}
