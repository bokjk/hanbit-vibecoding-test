import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

/**
 * 인증 및 인가를 관리하는 Construct
 *
 * 주요 기능:
 * - Cognito User Pool: 사용자 등록/로그인 관리
 * - Identity Pool: 게스트 사용자 지원 및 임시 자격 증명
 * - IAM 역할: 인증된 사용자와 게스트 사용자의 권한 분리
 * - 보안 정책: 최소 권한 원칙 적용
 */
export interface AuthConstructProps {
  todoTable: dynamodb.Table;
  environmentConfig: EnvironmentConfig;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly authenticatedRole: iam.Role;
  public readonly guestRole: iam.Role;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    // Cognito User Pool 생성
    this.userPool = new cognito.UserPool(this, 'TodoUserPool', {
      userPoolName: 'hanbit-todo-user-pool',

      // 사인인 설정
      signInAliases: {
        email: true,
        username: true,
      },

      // 사인업 설정
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
      },

      // 사용자 인증 설정
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },

      // 커스텀 속성
      customAttributes: {
        user_type: new cognito.StringAttribute({
          minLen: 4,
          maxLen: 20,
          mutable: true,
        }),
        session_id: new cognito.StringAttribute({
          minLen: 10,
          maxLen: 50,
          mutable: true,
        }),
        permissions: new cognito.StringAttribute({
          minLen: 10,
          maxLen: 1000,
          mutable: true,
        }),
      },

      // 패스워드 정책
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },

      // 계정 복구 설정
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // 이메일 설정
      email: cognito.UserPoolEmail.withCognito('noreply@hanbit-todo.com'),

      // 삭제 보호 설정
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 개발 환경용
    });

    // User Pool Client 생성
    this.userPoolClient = this.userPool.addClient('TodoUserPoolClient', {
      userPoolClientName: 'hanbit-todo-client',

      // 인증 흐름 설정
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
        adminUserPassword: true,
      },

      // 토큰 만료 설정
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // OAuth 설정 (향후 소셜 로그인 확장 대비)
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          'http://localhost:3000/auth/callback', // 개발 환경
          'https://todo-app.hanbit.com/auth/callback', // 프로덕션 환경 (예시)
        ],
        logoutUrls: [
          'http://localhost:3000/auth/logout',
          'https://todo-app.hanbit.com/auth/logout',
        ],
      },

      // CORS 설정
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
    });

    // Identity Pool 생성 (게스트 사용자 지원)
    this.identityPool = new cognito.CfnIdentityPool(this, 'TodoIdentityPool', {
      identityPoolName: 'hanbit-todo-identity-pool',
      allowUnauthenticatedIdentities: true, // 게스트 사용자 허용
      allowClassicFlow: false,

      // Cognito User Pool 연결
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
    });

    // 인증된 사용자용 IAM 역할
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      roleName: 'hanbit-todo-authenticated-role',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'IAM role for authenticated users to access TODO data',
    });

    // 게스트 사용자용 IAM 역할
    this.guestRole = new iam.Role(this, 'GuestRole', {
      roleName: 'hanbit-todo-guest-role',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'IAM role for guest users to access limited TODO data',
    });

    // 인증된 사용자 권한 정책
    this.authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
        ],
        resources: [props.todoTable.tableArn, `${props.todoTable.tableArn}/index/*`],
        conditions: {
          'ForAllValues:StringEquals': {
            'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
          },
        },
      })
    );

    // 게스트 사용자 권한 정책 (제한적)
    this.guestRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
        ],
        resources: [props.todoTable.tableArn, `${props.todoTable.tableArn}/index/*`],
        conditions: {
          'ForAllValues:StringEquals': {
            'dynamodb:LeadingKeys': ['GUEST#${cognito-identity.amazonaws.com:sub}'],
          },
          'ForAllValues:StringLike': {
            'dynamodb:Attributes': [
              'PK',
              'SK',
              'title',
              'completed',
              'priority',
              'createdAt',
              'updatedAt',
              'ttl', // TTL 속성 허용
            ],
          },
        },
      })
    );

    // CloudWatch Logs 권한 (모든 사용자)
    const logsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    });

    this.authenticatedRole.addToPolicy(logsPolicy);
    this.guestRole.addToPolicy(logsPolicy);

    // Identity Pool에 역할 연결
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.guestRole.roleArn,
      },
    });

    // 환경별 설정
    const environment = process.env.NODE_ENV || 'development';

    // 태그 추가
    cdk.Tags.of(this.userPool).add('Component', 'Authentication');
    cdk.Tags.of(this.identityPool).add('Component', 'Authentication');
    cdk.Tags.of(this.authenticatedRole).add('Component', 'Authentication');
    cdk.Tags.of(this.guestRole).add('Component', 'Authentication');

    cdk.Tags.of(this).add('Purpose', 'UserAuth');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('CostCenter', 'HanbitTodoApp');
    cdk.Tags.of(this).add('Owner', 'Backend-Team');

    // 출력 값 설정
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'TodoUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'TodoUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: 'TodoIdentityPoolId',
    });

    new cdk.CfnOutput(this, 'AuthenticatedRoleArn', {
      value: this.authenticatedRole.roleArn,
      description: 'Authenticated user IAM role ARN',
      exportName: 'TodoAuthenticatedRoleArn',
    });

    new cdk.CfnOutput(this, 'GuestRoleArn', {
      value: this.guestRole.roleArn,
      description: 'Guest user IAM role ARN',
      exportName: 'TodoGuestRoleArn',
    });
  }
}
