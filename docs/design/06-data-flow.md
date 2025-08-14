# 6. 데이터 플로우 설계

## 6.1 전체 데이터 플로우 개요

```mermaid
graph TB
    subgraph "1단계: 로컬 스토리지 기반"
        UI[사용자 인터페이스]
        CTX[React Context]
        RED[useReducer]
        LS[localStorage]

        UI --> CTX
        CTX --> RED
        RED --> LS
        LS --> RED
        RED --> CTX
        CTX --> UI
    end

    subgraph "2단계: API 통합"
        UI2[사용자 인터페이스]
        CTX2[React Context]
        RED2[useReducer]
        API[API Service]
        AWS[AWS Backend]
        SYNC[Sync Manager]

        UI2 --> CTX2
        CTX2 --> RED2
        RED2 --> API
        API --> AWS
        AWS --> API
        API --> RED2
        RED2 --> CTX2
        CTX2 --> UI2

        RED2 --> SYNC
        SYNC --> LS
    end
```

## 6.2 1단계 데이터 플로우 (MVP)

### 6.2.1 할 일 추가 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant TI as TodoInput
    participant TC as TodoContext
    participant R as Reducer
    participant LS as LocalStorage
    participant TL as TodoList

    U->>TI: 할 일 입력 & 우선순위 선택
    TI->>TI: 입력 검증
    TI->>TC: addTodo(title, priority)
    TC->>R: dispatch(ADD_TODO)
    R->>R: 새 Todo 객체 생성
    R->>LS: 상태 업데이트 & 저장
    LS-->>R: 저장 완료
    R-->>TC: 새로운 state 반환
    TC-->>TL: 업데이트된 todos 전달
    TL-->>U: 새 할 일 표시
```

### 6.2.2 할 일 완료 토글 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant TI as TodoItem
    participant TC as TodoContext
    participant R as Reducer
    participant LS as LocalStorage
    participant TL as TodoList

    U->>TI: 체크박스 클릭
    TI->>TC: toggleTodo(id)
    TC->>R: dispatch(TOGGLE_TODO)
    R->>R: completed 상태 토글
    R->>LS: 상태 업데이트 & 저장
    LS-->>R: 저장 완료
    R-->>TC: 새로운 state 반환
    TC-->>TL: 업데이트된 todos 전달
    TL-->>U: 변경된 상태 표시
```

### 6.2.3 할 일 삭제 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant TI as TodoItem
    participant TC as TodoContext
    participant R as Reducer
    participant LS as LocalStorage
    participant TL as TodoL보이st

    U->>TI: 삭제 버튼 클릭
    TI->>TI: 삭제 확인 다이얼로그
    U->>TI: 삭제 확인
    TI->>TC: deleteTodo(id)
    TC->>R: dispatch(DELETE_TODO)
    R->>R: 해당 Todo 제거
    R->>LS: 상태 업데이트 & 저장
    LS-->>R: 저장 완료
    R-->>TC: 새로운 state 반환
    TC-->>TL: 업데이트된 todos 전달
    TL-->>U: 삭제 결과 표시
```

### 6.2.4 필터링 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant TF as TodoFilters
    participant TC as TodoContext
    participant R as Reducer
    participant TL as TodoList

    U->>TF: 필터 옵션 선택
    TF->>TC: setFilter(filter)
    TC->>R: dispatch(SET_FILTER)
    R->>R: 필터 상태 업데이트
    R-->>TC: 새로운 state 반환
    TC->>TC: 필터링된 todos 계산
    TC-->>TL: 필터링된 todos 전달
    TL-->>U: 필터링 결과 표시
```

## 6.3 2단계 데이터 플로우 (API 통합)

### 6.3.1 앱 초기화 플로우

```mermaid
sequenceDiagram
    participant APP as App
    participant AUTH as AuthContext
    participant COG as Cognito
    participant API as APIService
    participant SYNC as SyncManager
    participant TC as TodoContext

    APP->>AUTH: 앱 시작
    AUTH->>COG: 저장된 토큰 확인

    alt 유효한 토큰 존재
        COG-->>AUTH: 인증 정보 반환
        AUTH->>API: API 클라이언트 초기화
        AUTH->>SYNC: 동기화 매니저 시작
        SYNC->>API: 서버 데이터 조회
        API-->>SYNC: 할 일 목록 반환
        SYNC->>TC: 로컬 데이터와 병합
    else 토큰 없음/만료
        COG-->>AUTH: 게스트 토큰 발급
        AUTH->>TC: 로컬 데이터 로드
        TC->>TC: localStorage에서 복원
    end

    AUTH-->>APP: 초기화 완료
```

### 6.3.2 낙관적 업데이트 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant TC as TodoContext
    participant R as Reducer
    participant LS as LocalStorage
    participant SYNC as SyncManager
    participant API as APIService

    U->>TC: 할 일 추가 요청
    TC->>R: dispatch(ADD_TODO)
    R->>R: 낙관적으로 상태 업데이트
    R->>LS: 임시 저장 (pending 상태)
    R-->>TC: UI 즉시 업데이트
    TC-->>U: 즉시 반영 표시

    par 백그라운드 동기화
        R->>SYNC: 동기화 큐에 추가
        SYNC->>API: 서버로 전송

        alt 성공
            API-->>SYNC: 성공 응답
            SYNC->>R: dispatch(SYNC_SUCCESS)
            R->>LS: 확정 상태로 업데이트
        else 실패
            API-->>SYNC: 에러 응답
            SYNC->>R: dispatch(SYNC_ERROR)
            R->>R: 로컬 상태 롤백
            R-->>TC: 에러 상태 전달
            TC-->>U: 에러 메시지 표시
        end
    end
```

### 6.3.3 오프라인 동기화 플로우

```mermaid
sequenceDiagram
    participant U as User
    participant TC as TodoContext
    participant SYNC as SyncManager
    participant LS as LocalStorage
    participant NET as NetworkDetector
    participant API as APIService

    U->>TC: 오프라인 상태에서 작업
    TC->>SYNC: 동기화 요청
    SYNC->>NET: 네트워크 상태 확인
    NET-->>SYNC: 오프라인 상태
    SYNC->>LS: 큐에 작업 저장
    SYNC-->>TC: 오프라인 확인
    TC-->>U: 오프라인 표시

    Note over NET: 네트워크 복구
    NET->>SYNC: 온라인 상태 변경
    SYNC->>LS: 대기 중인 작업 조회
    LS-->>SYNC: 큐의 작업들 반환

    loop 각 대기 작업
        SYNC->>API: 서버 동기화
        alt 성공
            API-->>SYNC: 성공 응답
            SYNC->>LS: 큐에서 제거
        else 실패
            API-->>SYNC: 에러 응답
            SYNC->>SYNC: 재시도 카운터 증가
        end
    end

    SYNC->>TC: 동기화 완료 알림
    TC-->>U: 온라인 상태 표시
```

### 6.3.4 충돌 해결 플로우

```mermaid
sequenceDiagram
    participant LOCAL as LocalState
    participant SYNC as SyncManager
    participant API as APIService
    participant USER as User

    SYNC->>API: 로컬 변경사항 업로드
    API-->>SYNC: 충돌 응답 (409)

    SYNC->>SYNC: 충돌 감지
    SYNC->>LOCAL: 현재 로컬 상태 조회
    LOCAL-->>SYNC: 로컬 데이터 반환

    SYNC->>API: 서버 최신 상태 조회
    API-->>SYNC: 서버 데이터 반환

    SYNC->>SYNC: 충돌 해결 전략 결정

    alt 자동 병합 가능
        SYNC->>SYNC: 자동 병합 수행
        SYNC->>LOCAL: 병합된 상태 업데이트
        SYNC->>API: 병합 결과 업로드
    else 수동 해결 필요
        SYNC->>USER: 충돌 해결 UI 표시
        USER->>SYNC: 해결 방식 선택
        SYNC->>LOCAL: 선택된 해결방식 적용
        SYNC->>API: 해결된 상태 업로드
    end

    API-->>SYNC: 동기화 완료
    SYNC->>LOCAL: 최종 상태 확정
```

## 6.4 에러 처리 플로우

### 6.4.1 네트워크 오류 처리

```mermaid
sequenceDiagram
    participant TC as TodoContext
    participant API as APIService
    participant ERR as ErrorHandler
    participant USER as User

    TC->>API: API 요청
    API-->>TC: 네트워크 오류
    TC->>ERR: 오류 처리 위임

    ERR->>ERR: 오류 분류

    alt 일시적 오류
        ERR->>ERR: 재시도 로직 실행
        ERR->>API: 요청 재시도

        alt 재시도 성공
            API-->>ERR: 성공 응답
            ERR-->>TC: 성공 결과 반환
        else 재시도 실패
            ERR->>USER: 재시도 실패 알림
        end
    else 영구적 오료
        ERR->>USER: 오류 메시지 표시
        ERR->>TC: 로컬 모드로 전환
    end
```

---

**이전**: [상태 관리 설계](05-state-management.md)  
**다음**: [API 설계](07-api-design.md)
