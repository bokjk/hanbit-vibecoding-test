import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { resolve } from 'path';

export interface LambdaConstructProps {
  todoTable: dynamodb.Table;
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
  };

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    const { todoTable } = props;

    // 공통 Lambda 설정
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE_NAME: todoTable.tableName,
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
    };

    // DynamoDB 테이블 접근 권한 부여
    Object.values(this.todoHandlers).forEach(handler => {
      todoTable.grantReadWriteData(handler);
    });

    Object.values(this.authHandlers).forEach(handler => {
      todoTable.grantReadData(handler);
    });

    // 태그 추가
    const allHandlers = [...Object.values(this.todoHandlers), ...Object.values(this.authHandlers)];
    allHandlers.forEach(handler => {
      cdk.Tags.of(handler).add('Component', 'Lambda');
      cdk.Tags.of(handler).add('Project', 'HanbitTodo');
    });
  }
}