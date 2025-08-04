# 2. 시스템 아키텍처

## 2.1 전체 아키텍처 개요

![전체 아키텍처](../image/overall-architecture.svg)

## 2.2 1단계 아키텍처 (MVP)

```
Frontend Application
├── Presentation Layer (React Components)
├── Business Logic Layer (Custom Hooks)
├── State Management Layer (Context + Reducer)
└── Data Access Layer (localStorage Service)
```

## 2.3 2단계 확장 아키텍처 (AWS 서버리스)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Client (React SPA)                               │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐ │
│  │  Auth Context    │ │  API Service     │ │   Data Sync Manager      │ │
│  │  (Cognito SDK)   │ │  (HTTP Client)   │ │   (Optimistic Updates)   │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AWS Cloud Infrastructure                         │
│                                                                         │
│  ┌─────────────────┐      ┌────────────────────────────────────────┐   │
│  │   CloudFront    │◄────►│          API Gateway (REST)            │   │
│  │  (CDN + CORS)   │      │  • /api/todos (CRUD operations)       │   │
│  └─────────────────┘      │  • /api/auth (authentication)         │   │
│                           │  • Cognito Authorizer integration     │   │
│                           └────────────────────────────────────────┘   │
│                                              │                         │
│                                              ▼                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AWS Lambda Functions                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │ getTodos    │  │ createTodo  │  │     authHandler         │ │   │
│  │  │ handler     │  │ handler     │  │  (guest token issue)    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │ updateTodo  │  │ deleteTodo  │  │     migrationHandler    │ │   │
│  │  │ handler     │  │ handler     │  │  (localStorage import)  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                              │                         │
│                                              ▼                         │
│  ┌─────────────────┐                 ┌──────────────────────────────┐  │
│  │  Amazon Cognito │                 │       Amazon DynamoDB        │  │
│  │                 │                 │                              │  │
│  │ ┌─────────────┐ │                 │  ┌─────────────────────────┐ │  │
│  │ │ User Pool   │ │                 │  │    todos-app-data       │ │  │
│  │ │(Optional    │ │                 │  │  (Single Table Design)  │ │  │
│  │ │Registration)│ │                 │  │                         │ │  │
│  │ └─────────────┘ │                 │  │ PK: USER#{userId}       │ │  │
│  │ ┌─────────────┐ │                 │  │ SK: TODO#{todoId}       │ │  │
│  │ │Identity Pool│ │                 │  │ PK: GUEST#{sessionId}   │ │  │
│  │ │(Guest +     │ │◄────────────────┤  │ TTL: 24h (guest data)   │ │  │
│  │ │Authenticated│ │                 │  │                         │ │  │
│  │ │Roles)       │ │                 │  │ GSI1: Query optimization│ │  │
│  │ └─────────────┘ │                 │  └─────────────────────────┘ │  │
│  └─────────────────┘                 └──────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    CloudWatch Monitoring                        │  │
│  │  • Lambda execution logs & metrics                              │  │
│  │  • API Gateway request/response logs                            │  │
│  │  • DynamoDB performance metrics                                 │  │
│  │  • X-Ray distributed tracing                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.4 단계별 아키텍처 진화

![단계별 아키텍처 진화](../image/architecture-evolution.svg)

---

**이전**: [문서 개요](01-overview.md)  
**다음**: [데이터 모델](03-data-models.md)