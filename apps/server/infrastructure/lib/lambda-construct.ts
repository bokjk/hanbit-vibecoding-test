import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { resolve } from 'path';

export interface LambdaConstructProps {
  todoTable: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  identityPool: cognito.CfnIdentityPool;
}

/**
 * Lambda 함수들을 관리하는 Construct
 * TODO 관련 핸들러와 인증 관련 핸들러 포함
 */
export class LambdaConstruct extends Construct {
  public readonly todoHandlers: {
    createTodo: lambda.Function;
    listTodos: lambda.Function;
    updateTodo: lambda.Function;
    deleteTodo: lambda.Function;
  };

  public readonly authHandlers: {
    login: lambda.Function;
    refresh: lambda.Function;
    guestAuth: lambda.Function;
  };

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const { todoTable, userPool, userPoolClient, identityPool } = props;

    // 공통 Lambda 설정
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE_NAME: todoTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_IDENTITY_POOL_ID: identityPool.ref,
        AWS_REGION: cdk.Stack.of(this).region,
        NODE_ENV: process.env.NODE_ENV || 'development',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
      },
    };

    // Lambda 함수 코드 경로
    const lambdaCodePath = resolve(__dirname, '../../lambda');

    // TODO 핸들러들
    this.todoHandlers = {
      createTodo: new lambda.Function(this, 'CreateTodoHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-todo-create',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'handlers/todos/create.handler',
        description: '새로운 TODO 아이템 생성',
      }),

      listTodos: new lambda.Function(this, 'ListTodosHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-todo-list',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'handlers/todos/list.handler',
        description: 'TODO 목록 조회',
      }),

      updateTodo: new lambda.Function(this, 'UpdateTodoHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-todo-update',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'handlers/todos/update.handler',
        description: 'TODO 아이템 업데이트',
      }),

      deleteTodo: new lambda.Function(this, 'DeleteTodoHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-todo-delete',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'handlers/todos/delete.handler',
        description: 'TODO 아이템 삭제',
      }),
    };

    // 인증 핸들러들
    this.authHandlers = {
      login: new lambda.Function(this, 'LoginHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-auth-login',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'handlers/auth/login.handler',
        description: '사용자 로그인 처리',
      }),

      refresh: new lambda.Function(this, 'RefreshHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-auth-refresh',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'handlers/auth/refresh.handler',
        description: '토큰 갱신 처리',
      }),

      guestAuth: new lambda.Function(this, 'GuestAuthHandler', {
        ...commonLambdaProps,
        functionName: 'hanbit-auth-guest',
        code: lambda.Code.fromAsset(lambdaCodePath),
        handler: 'auth/guest-auth.handler',
        description: '게스트 사용자 인증 처리',
        timeout: cdk.Duration.seconds(15), // 게스트 인증은 더 빠르게
        memorySize: 256, // 메모리 사용량 최적화
      }),
    };

    // DynamoDB 테이블 접근 권한 부여
    Object.values(this.todoHandlers).forEach(handler => {
      todoTable.grantReadWriteData(handler);
    });

    Object.values(this.authHandlers).forEach(handler => {
      todoTable.grantReadData(handler);
    });

    // 게스트 인증 핸들러에 Cognito Identity Pool 접근 권한 추가
    this.authHandlers.guestAuth.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-identity:GetId', 'cognito-identity:GetCredentialsForIdentity'],
        resources: ['*'], // Identity Pool은 리소스별 제한이 불가능
      })
    );

    // 태그 추가
    const allHandlers = [...Object.values(this.todoHandlers), ...Object.values(this.authHandlers)];
    allHandlers.forEach(handler => {
      cdk.Tags.of(handler).add('Component', 'Lambda');
      cdk.Tags.of(handler).add('Project', 'HanbitTodo');
    });
  }
}
