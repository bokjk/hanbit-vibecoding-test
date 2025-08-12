import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './database-construct';
import { AuthConstruct } from './auth-construct';
import { LambdaConstruct } from './lambda-construct';
import { ApiConstruct } from './api-construct';
import { MonitoringConstruct } from './monitoring-construct';
import { SecretsConstruct, createLambdaEnvironmentVariables } from '../config/secrets';
import { EnvironmentConfig } from '../config/environment';

/**
 * 확장된 스택 Props 인터페이스
 */
export interface HanbitStackProps extends cdk.StackProps {
  /** 환경별 설정 */
  environmentConfig: EnvironmentConfig;
}

/**
 * Hanbit TODO 앱의 메인 CDK 스택
 * DynamoDB, Lambda, API Gateway를 포함하는 서버리스 아키텍처
 * 환경별 설정 및 시크릿 관리 지원
 */
export class HanbitStack extends cdk.Stack {
  public readonly config: EnvironmentConfig;
  public readonly secrets: SecretsConstruct;

  constructor(scope: Construct, id: string, props: HanbitStackProps) {
    super(scope, id, props);

    this.config = props.environmentConfig;

    // 시크릿 관리 스택 생성
    this.secrets = new SecretsConstruct(this, 'Secrets', this.config);

    // DynamoDB 테이블 생성 (환경별 설정 적용)
    const database = new DatabaseConstruct(this, 'Database', {
      environmentConfig: this.config,
    });

    // 인증 스택 생성 (Cognito)
    const auth = new AuthConstruct(this, 'Auth', {
      todoTable: database.todoTable,
      environmentConfig: this.config,
    });

    // Lambda 환경 변수 생성
    const lambdaEnvironment = createLambdaEnvironmentVariables(this.config, this.secrets);

    // Lambda 함수들 생성 (환경별 설정 및 시크릿 적용)
    const lambda = new LambdaConstruct(this, 'Lambda', {
      todoTable: database.todoTable,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      identityPool: auth.identityPool,
      environmentConfig: this.config,
      environment: lambdaEnvironment,
      secrets: this.secrets,
    });

    // API Gateway 생성 (환경별 설정 적용)
    const api = new ApiConstruct(this, 'Api', {
      todoHandlers: lambda.todoHandlers,
      authHandlers: lambda.authHandlers,
      userPool: auth.userPool,
      environmentConfig: this.config,
    });

    // 모니터링 스택 생성 (CloudWatch)
    const monitoring = new MonitoringConstruct(this, 'Monitoring', {
      restApi: api.restApi,
      todoTable: database.todoTable,
      todoHandlers: lambda.todoHandlers,
      authHandlers: lambda.authHandlers,
      alertEmail: this.config.monitoring.alertEmail,
      environmentConfig: this.config,
    });

    // 출력 값들 (환경별 접미사 포함)
    new cdk.CfnOutput(this, `ApiEndpoint${this.config.stackSuffix}`, {
      value: api.restApi.url,
      description: `API Gateway 엔드포인트 (${this.config.name})`,
      exportName: `HanbitTodo-ApiEndpoint-${this.config.name}`,
    });

    new cdk.CfnOutput(this, `TodoTableName${this.config.stackSuffix}`, {
      value: database.todoTable.tableName,
      description: `DynamoDB 테이블 이름 (${this.config.name})`,
      exportName: `HanbitTodo-TodoTableName-${this.config.name}`,
    });

    new cdk.CfnOutput(this, `UserPoolId${this.config.stackSuffix}`, {
      value: auth.userPool.userPoolId,
      description: `Cognito User Pool ID (${this.config.name})`,
      exportName: `HanbitTodo-UserPoolId-${this.config.name}`,
    });

    new cdk.CfnOutput(this, `UserPoolClientId${this.config.stackSuffix}`, {
      value: auth.userPoolClient.userPoolClientId,
      description: `Cognito User Pool Client ID (${this.config.name})`,
      exportName: `HanbitTodo-UserPoolClientId-${this.config.name}`,
    });

    new cdk.CfnOutput(this, `IdentityPoolId${this.config.stackSuffix}`, {
      value: auth.identityPool.ref,
      description: `Cognito Identity Pool ID (${this.config.name})`,
      exportName: `HanbitTodo-IdentityPoolId-${this.config.name}`,
    });

    new cdk.CfnOutput(this, `DashboardUrl${this.config.stackSuffix}`, {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${monitoring.dashboard.dashboardName}`,
      description: `CloudWatch 대시보드 URL (${this.config.name})`,
    });

    new cdk.CfnOutput(this, `AlarmTopicArn${this.config.stackSuffix}`, {
      value: monitoring.alarmTopic.topicArn,
      description: `SNS 알람 토픽 ARN (${this.config.name})`,
      exportName: `HanbitTodo-AlarmTopicArn-${this.config.name}`,
    });

    // 시크릿 관련 출력값
    new cdk.CfnOutput(this, `JwtSecretArn${this.config.stackSuffix}`, {
      value: this.secrets.jwtSecret.secretArn,
      description: `JWT Secret ARN (${this.config.name})`,
      exportName: `HanbitTodo-JwtSecretArn-${this.config.name}`,
    });

    new cdk.CfnOutput(this, `ApiKeysSecretArn${this.config.stackSuffix}`, {
      value: this.secrets.apiKeysSecret.secretArn,
      description: `API Keys Secret ARN (${this.config.name})`,
      exportName: `HanbitTodo-ApiKeysSecretArn-${this.config.name}`,
    });

    // 환경 정보 출력
    new cdk.CfnOutput(this, `Environment${this.config.stackSuffix}`, {
      value: this.config.name,
      description: '배포된 환경',
      exportName: `HanbitTodo-Environment-${this.config.name}`,
    });
  }
}
