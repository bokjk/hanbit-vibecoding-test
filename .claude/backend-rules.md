# 백엔드 개발 규칙

## 🎯 TDD 필수 원칙

### Red-Green-Refactor 사이클
- **Red**: 실패하는 테스트를 먼저 작성하세요
- **Green**: 테스트를 통과하는 최소 코드를 구현하세요  
- **Refactor**: 테스트를 유지하면서 리팩토링하세요

```typescript
// ✅ TDD 예시: 백엔드 서비스
describe('TodoService', () => {
  it('should create a new todo with valid data', async () => {
    // Given
    const todoData = { title: 'Test Todo', completed: false };
    
    // When
    const result = await todoService.create(todoData);
    
    // Then
    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test Todo');
    expect(result.completed).toBe(false);
  });
});
```

## 🏗️ AWS Lambda 아키텍처

### Lambda 핸들러 패턴
```typescript
// ✅ Lambda 핸들러 구조
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // 요청 검증
    const body = parseRequestBody(event.body);
    
    // 비즈니스 로직 (서비스 레이어 호출)
    const result = await todoService.create(body);
    
    // 응답 반환
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
};
```

### 서버리스 베스트 프랙티스
- **콜드 스타트 최소화**: 함수 외부에서 의존성 초기화
- **환경 변수 활용**: 설정을 코드에서 분리
- **타임아웃 설정**: 적절한 실행 시간 제한
- **메모리 최적화**: 함수별 적절한 메모리 할당

## 🛡️ 입력 검증 및 보안

### 요청 검증
```typescript
// ✅ 입력 검증 패턴
import { z } from 'zod';

const CreateTodoSchema = z.object({
  title: z.string().min(1).max(100),
  completed: z.boolean().optional().default(false),
});

function validateCreateTodo(data: unknown): CreateTodoRequest {
  try {
    return CreateTodoSchema.parse(data);
  } catch (error) {
    throw new ValidationError('Invalid todo data', error);
  }
}
```

### 보안 고려사항
- **SQL 인젝션 방지**: 준비된 쿼리문 사용
- **XSS 방지**: 사용자 입력 정화
- **CORS 설정**: 적절한 도메인 허용
- **인증/인가**: JWT 토큰 검증
- **Rate Limiting**: API 호출 제한

## 📊 데이터베이스 패턴

### Repository 패턴
```typescript
// ✅ Repository 인터페이스
interface TodoRepository {
  create(todo: CreateTodoRequest): Promise<Todo>;
  findById(id: string): Promise<Todo | null>;
  findAll(userId: string): Promise<Todo[]>;
  update(id: string, updates: UpdateTodoRequest): Promise<Todo>;
  delete(id: string): Promise<void>;
}

// ✅ DynamoDB 구현체
export class DynamoTodoRepository implements TodoRepository {
  constructor(private dynamoClient: DynamoDBClient) {}
  
  async create(todo: CreateTodoRequest): Promise<Todo> {
    const item = {
      id: generateId(),
      ...todo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await this.dynamoClient.putItem({
      TableName: 'todos',
      Item: marshall(item),
    });
    
    return item;
  }
}
```

## 🔧 서비스 레이어 패턴

### 비즈니스 로직 분리
```typescript
// ✅ 서비스 클래스 구조
export class TodoService {
  constructor(
    private todoRepository: TodoRepository,
    private logger: Logger
  ) {}
  
  async createTodo(userId: string, data: CreateTodoRequest): Promise<Todo> {
    // 비즈니스 규칙 검증
    if (!userId) {
      throw new UnauthorizedError('User ID is required');
    }
    
    // 비즈니스 로직 실행
    const todo = await this.todoRepository.create({
      ...data,
      userId,
    });
    
    // 로깅
    this.logger.info('Todo created', { todoId: todo.id, userId });
    
    return todo;
  }
}
```

## 🚨 에러 처리

### 계층별 에러 처리
```typescript
// ✅ 커스텀 에러 클래스
export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

// ✅ 에러 응답 생성
function createErrorResponse(error: Error): APIGatewayProxyResult {
  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Bad Request',
        message: error.message,
        details: error.details,
      }),
    };
  }
  
  if (error instanceof NotFoundError) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Not Found',
        message: error.message,
      }),
    };
  }
  
  // 예상치 못한 에러는 로깅 후 일반적인 메시지 반환
  logger.error('Unexpected error', error);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    }),
  };
}
```

## 📝 로깅 및 모니터링

### 구조화된 로깅
```typescript
// ✅ 로거 인터페이스
interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

// ✅ CloudWatch 로거 구현
export class CloudWatchLogger implements Logger {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }));
  }
}
```

## 🏛️ Clean Architecture 적용

### 의존성 방향
```
Controller (Lambda Handler)
    ↓
Service (Business Logic)
    ↓
Repository (Data Access)
    ↓
Database (Infrastructure)
```

### 의존성 주입 패턴
```typescript
// ✅ 의존성 컨테이너
export class Container {
  private static instance: Container;
  
  private constructor(
    public todoRepository: TodoRepository,
    public todoService: TodoService,
    public logger: Logger
  ) {}
  
  static getInstance(): Container {
    if (!Container.instance) {
      const logger = new CloudWatchLogger();
      const todoRepository = new DynamoTodoRepository(dynamoClient);
      const todoService = new TodoService(todoRepository, logger);
      
      Container.instance = new Container(todoRepository, todoService, logger);
    }
    return Container.instance;
  }
}
```

## 🚨 필수 체크리스트

백엔드 개발 시 반드시 확인하세요:

- [ ] 테스트 먼저 작성 (TDD)
- [ ] 입력 검증 구현
- [ ] 에러 처리 완료
- [ ] 로깅 추가
- [ ] 보안 검토
- [ ] 성능 테스트
- [ ] 배포 스크립트 확인