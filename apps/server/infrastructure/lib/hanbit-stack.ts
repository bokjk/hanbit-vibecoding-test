import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './database-construct';
import { AuthConstruct } from './auth-construct';
import { LambdaConstruct } from './lambda-construct';
import { ApiConstruct } from './api-construct';
import { MonitoringConstruct } from './monitoring-construct';
import { DeploymentMonitoringConstruct } from './deployment-monitoring-construct';
import { DeploymentHistoryConstruct } from './deployment-history-construct';
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
  // 임시 주석 처리
  // public readonly deploymentHistory: DeploymentHistoryConstruct;
  // public readonly deploymentMonitoring: DeploymentMonitoringConstruct;

  constructor(scope: Construct, id: string, props: HanbitStackProps) {
    super(scope, id, props);

    this.config = props.environmentConfig;

    // 시크릿 관리 스택 생성
    this.secrets = new SecretsConstruct(this, 'Secrets', this.config);

    // DynamoDB 테이블 생성 (환경별 설정 적용)
    const database = new DatabaseConstruct(this, 'Database');

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
      secrets: this.secrets,
    });

    // API Gateway 생성 (환경별 설정 적용)
    const api = new ApiConstruct(this, 'Api', {
      todoHandlers: lambda.todoHandlers,
      authHandlers: lambda.authHandlers,
      userPool: auth.userPool,
      environmentConfig: this.config,
    });

    // 모니터링 스택도 임시 주석 처리 (토큰 에러 해결을 위해)
    // const monitoring = new MonitoringConstruct(this, 'Monitoring', {
    //   restApi: api.restApi,
    //   todoTable: database.todoTable,
    //   todoHandlers: lambda.todoHandlers,
    //   authHandlers: lambda.authHandlers,
    //   environmentConfig: this.config,
    //   alertEmail: this.config.monitoring.alertEmail || 'admin@example.com',
    // });

    // 배포 히스토리 및 모니터링 스택 임시 주석 처리 (빠른 배포 테스트용)
    // this.deploymentHistory = new DeploymentHistoryConstruct(this, 'DeploymentHistory', {
    //   environmentConfig: this.config,
    // });

    // this.deploymentHistory.createApiIntegration(api.restApi);

    // const allLambdaFunctions = {
    //   ...lambda.todoHandlers,
    //   ...lambda.authHandlers,
    //   deploymentHistory: this.deploymentHistory.deploymentHistoryFunction,
    //   deploymentStats: this.deploymentHistory.deploymentStatsFunction,
    // };

    // this.deploymentMonitoring = new DeploymentMonitoringConstruct(this, 'DeploymentMonitoring', {
    //   api: api.restApi,
    //   lambdaFunctions: allLambdaFunctions,
    //   alertEmail: this.config.monitoring.alertEmail || 'admin@example.com',
    //   slackWebhookUrl: this.config.monitoring.slackWebhookUrl,
    //   environmentConfig: this.config,
    // });

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

    // 모니터링 관련 출력도 임시 주석 처리
    // new cdk.CfnOutput(this, `DashboardUrl${this.config.stackSuffix}`, {
    //   value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${monitoring.dashboard.dashboardName}`,
    //   description: `CloudWatch 대시보드 URL (${this.config.name})`,
    // });

    // new cdk.CfnOutput(this, `AlarmTopicArn${this.config.stackSuffix}`, {
    //   value: monitoring.alarmTopic.topicArn,
    //   description: `SNS 알람 토픽 ARN (${this.config.name})`,
    //   exportName: `HanbitTodo-AlarmTopicArn-${this.config.name}`,
    // });

    // 배포 관련 출력들 임시 주석 처리
    // new cdk.CfnOutput(this, `DeploymentAlarmTopicArn${this.config.stackSuffix}`, {
    //   value: this.deploymentMonitoring.deploymentAlarmTopic.topicArn,
    //   description: `배포 알람 토픽 ARN (${this.config.name})`,
    //   exportName: `HanbitTodo-DeploymentAlarmTopicArn-${this.config.name}`,
    // });

    // new cdk.CfnOutput(this, `DeploymentHistoryTableName${this.config.stackSuffix}`, {
    //   value: this.deploymentHistory.deploymentHistoryTable.tableName,
    //   description: `배포 히스토리 테이블 이름 (${this.config.name})`,
    //   exportName: `HanbitTodo-DeploymentHistoryTableName-${this.config.name}`,
    // });

    // new cdk.CfnOutput(this, `DeploymentDashboardUrl${this.config.stackSuffix}`, {
    //   value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.deploymentMonitoring.deploymentDashboard.dashboardName}`,
    //   description: `배포 모니터링 대시보드 URL (${this.config.name})`,
    // });

    // new cdk.CfnOutput(this, `HealthCheckFunctionName${this.config.stackSuffix}`, {
    //   value: this.deploymentMonitoring.healthCheckFunction.functionName,
    //   description: `헬스체크 Lambda 함수 이름 (${this.config.name})`,
    //   exportName: `HanbitTodo-HealthCheckFunctionName-${this.config.name}`,
    // });

    // new cdk.CfnOutput(this, `RollbackFunctionName${this.config.stackSuffix}`, {
    //   value: this.deploymentMonitoring.rollbackFunction.functionName,
    //   description: `롤백 Lambda 함수 이름 (${this.config.name})`,
    //   exportName: `HanbitTodo-RollbackFunctionName-${this.config.name}`,
    // });

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
