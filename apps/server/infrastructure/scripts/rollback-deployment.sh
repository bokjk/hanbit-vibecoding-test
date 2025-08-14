#!/bin/bash

# 배포 롤백 스크립트
# 사용법: ./rollback-deployment.sh [환경] [롤백대상_배포ID]

set -e

# 기본값 설정
ENVIRONMENT=${1:-"prod"}
ROLLBACK_TARGET=${2}
AWS_REGION=${AWS_REGION:-"ap-northeast-2"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 안전 확인 함수
confirm_rollback() {
    if [ "$ENVIRONMENT" = "prod" ]; then
        echo
        log_warning "⚠️  프로덕션 환경 롤백을 시도하고 있습니다!"
        log_warning "환경: $ENVIRONMENT"
        log_warning "롤백 대상: $ROLLBACK_TARGET"
        echo
        
        read -p "정말로 롤백을 진행하시겠습니까? (yes/no): " CONFIRM
        
        if [ "$CONFIRM" != "yes" ]; then
            log_info "롤백이 취소되었습니다."
            exit 0
        fi
    fi
}

# 스크립트 시작
log_info "배포 롤백 시작"
log_info "환경: $ENVIRONMENT"
log_info "리전: $AWS_REGION"

if [ -z "$ROLLBACK_TARGET" ]; then
    log_error "롤백 대상이 지정되지 않았습니다."
    echo "사용법: $0 [환경] [롤백대상_배포ID]"
    echo
    echo "최근 배포 목록을 확인하세요:"
    
    # 최근 성공한 배포 목록 조회
    aws lambda invoke \
        --region "$AWS_REGION" \
        --function-name "HanbitTodoStack-${ENVIRONMENT}-DeploymentHistory-DeploymentHistoryFunction" \
        --payload "{\"httpMethod\": \"GET\", \"queryStringParameters\": {\"limit\": \"10\", \"status\": \"success\"}}" \
        response.json > /dev/null 2>&1
    
    if [ -f response.json ]; then
        DEPLOYMENTS=$(cat response.json | jq -r '.body' | jq -r '.deployments[]? | "\(.deploymentId) - \(.timestamp) - \(.status)"' 2>/dev/null || echo "")
        
        if [ -n "$DEPLOYMENTS" ]; then
            echo "최근 성공한 배포:"
            echo "$DEPLOYMENTS"
        fi
        
        rm -f response.json
    fi
    
    exit 1
fi

log_info "롤백 대상: $ROLLBACK_TARGET"

# 안전 확인
confirm_rollback

# 1. 롤백 대상 검증
log_info "롤백 대상 검증 중..."

aws lambda invoke \
    --region "$AWS_REGION" \
    --function-name "HanbitTodoStack-${ENVIRONMENT}-DeploymentHistory-DeploymentHistoryFunction" \
    --payload "{\"httpMethod\": \"GET\", \"pathParameters\": {\"deploymentId\": \"$ROLLBACK_TARGET\"}}" \
    rollback-target-check.json > /dev/null 2>&1

if [ ! -f rollback-target-check.json ]; then
    log_error "롤백 대상 조회 실패"
    exit 1
fi

TARGET_STATUS=$(cat rollback-target-check.json | jq -r '.statusCode' 2>/dev/null || echo "500")

if [ "$TARGET_STATUS" != "200" ]; then
    log_error "롤백 대상을 찾을 수 없습니다: $ROLLBACK_TARGET"
    cat rollback-target-check.json | jq -r '.body' 2>/dev/null || echo "상세 정보 없음"
    rm -f rollback-target-check.json
    exit 1
fi

TARGET_INFO=$(cat rollback-target-check.json | jq -r '.body' | jq .)
TARGET_COMMIT=$(echo "$TARGET_INFO" | jq -r '.commitSha // "unknown"')
TARGET_TIMESTAMP=$(echo "$TARGET_INFO" | jq -r '.timestamp')

log_success "롤백 대상 확인됨"
log_info "  - 배포 ID: $ROLLBACK_TARGET"
log_info "  - 커밋: $TARGET_COMMIT"
log_info "  - 배포 시간: $TARGET_TIMESTAMP"

rm -f rollback-target-check.json

# 2. 현재 상태 백업
log_info "현재 상태 백업 중..."

CURRENT_DEPLOYMENT_ID="rollback-backup-$TIMESTAMP"

# 현재 스택 상태 기록
CURRENT_STACK_INFO=$(aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "HanbitTodoStack-$ENVIRONMENT" \
    --query 'Stacks[0].{Status:StackStatus,LastUpdated:LastUpdatedTime,Description:Description}' \
    --output json 2>/dev/null || echo "{}")

# 백업 정보를 배포 히스토리에 기록
aws dynamodb put-item \
    --region "$AWS_REGION" \
    --table-name "deployment-history-$ENVIRONMENT" \
    --item "{
        \"deploymentId\": {\"S\": \"$CURRENT_DEPLOYMENT_ID\"},
        \"timestamp\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"},
        \"environment\": {\"S\": \"$ENVIRONMENT\"},
        \"status\": {\"S\": \"backup\"},
        \"deploymentType\": {\"S\": \"backup\"},
        \"details\": {\"S\": \"$(echo "$CURRENT_STACK_INFO" | jq -c .)\"},
        \"ttl\": {\"N\": \"$(($(date +%s) + 7776000))\"}
    }" > /dev/null 2>&1

log_success "현재 상태 백업 완료: $CURRENT_DEPLOYMENT_ID"

# 3. 롤백 실행 기록 시작
log_info "롤백 실행 기록 중..."

ROLLBACK_DEPLOYMENT_ID="rollback-$TIMESTAMP"

aws dynamodb put-item \
    --region "$AWS_REGION" \
    --table-name "deployment-history-$ENVIRONMENT" \
    --item "{
        \"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"},
        \"timestamp\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"},
        \"environment\": {\"S\": \"$ENVIRONMENT\"},
        \"status\": {\"S\": \"in_progress\"},
        \"deploymentType\": {\"S\": \"rollback\"},
        \"rollbackTarget\": {\"S\": \"$ROLLBACK_TARGET\"},
        \"deployedBy\": {\"S\": \"$(whoami)\"},
        \"details\": {\"S\": \"{\\\"rollbackTarget\\\": \\\"$ROLLBACK_TARGET\\\", \\\"backupId\\\": \\\"$CURRENT_DEPLOYMENT_ID\\\"}\"},
        \"ttl\": {\"N\": \"$(($(date +%s) + 7776000))\"}
    }" > /dev/null 2>&1

log_success "롤백 기록 시작: $ROLLBACK_DEPLOYMENT_ID"

# 4. Slack 알림 (롤백 시작)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    log_info "롤백 시작 알림 전송 중..."
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"text\": \"🔄 배포 롤백 시작\",
            \"attachments\": [{
                \"color\": \"warning\",
                \"fields\": [
                    {\"title\": \"환경\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                    {\"title\": \"롤백 ID\", \"value\": \"$ROLLBACK_DEPLOYMENT_ID\", \"short\": true},
                    {\"title\": \"롤백 대상\", \"value\": \"$ROLLBACK_TARGET\", \"short\": true},
                    {\"title\": \"실행자\", \"value\": \"$(whoami)\", \"short\": true}
                ]
            }]
        }" \
        "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
    
    log_success "롤백 시작 알림 전송 완료"
fi

# 5. CDK를 이용한 실제 롤백
log_info "CDK 롤백 실행 중..."

cd "$(dirname "$0")/.."  # infrastructure 디렉토리로 이동

if [ ! -f "package.json" ]; then
    log_error "CDK 프로젝트 디렉토리를 찾을 수 없습니다."
    exit 1
fi

# CDK 의존성 확인
if ! command -v cdk &> /dev/null; then
    log_info "CDK 설치 중..."
    npm install -g aws-cdk
fi

# 롤백 방법 결정
if [ "$TARGET_COMMIT" != "unknown" ]; then
    log_info "Git 커밋을 이용한 롤백"
    
    # 현재 브랜치 백업
    CURRENT_BRANCH=$(git branch --show-current)
    CURRENT_COMMIT=$(git rev-parse HEAD)
    
    log_info "  - 현재 브랜치: $CURRENT_BRANCH"
    log_info "  - 현재 커밋: $CURRENT_COMMIT"
    log_info "  - 롤백 대상 커밋: $TARGET_COMMIT"
    
    # 임시 브랜치 생성 및 체크아웃
    TEMP_BRANCH="rollback-$TIMESTAMP"
    git checkout -b "$TEMP_BRANCH" "$TARGET_COMMIT"
    
    log_info "임시 브랜치 생성: $TEMP_BRANCH"
else
    log_warning "커밋 정보가 없어 현재 코드로 스택 재배포를 시도합니다."
fi

# CDK 배포 실행
log_info "CDK 배포 시작..."
DEPLOY_START_TIME=$(date +%s)

# 의존성 설치
npm ci

# 배포 실행
if cdk deploy "HanbitTodoStack-$ENVIRONMENT" \
    --require-approval never \
    --outputs-file outputs.json \
    --context environment="$ENVIRONMENT"; then
    
    DEPLOY_END_TIME=$(date +%s)
    DEPLOY_DURATION=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
    
    log_success "CDK 롤백 완료 (소요시간: ${DEPLOY_DURATION}초)"
else
    log_error "CDK 롤백 실패"
    
    # Git 상태 복원 (커밋 기반 롤백인 경우)
    if [ "$TARGET_COMMIT" != "unknown" ]; then
        git checkout "$CURRENT_BRANCH"
        git branch -D "$TEMP_BRANCH"
        log_info "Git 상태 복원 완료"
    fi
    
    # 롤백 실패 기록
    aws dynamodb update-item \
        --region "$AWS_REGION" \
        --table-name "deployment-history-$ENVIRONMENT" \
        --key "{
            \"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"},
            \"timestamp\": {\"S\": \"$(aws dynamodb get-item --table-name deployment-history-$ENVIRONMENT --key "{\"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"}}" --query 'Item.timestamp.S' --output text)\""}
        }" \
        --update-expression "SET #status = :status, errorMessage = :error" \
        --expression-attribute-names "{\"#status\": \"status\"}" \
        --expression-attribute-values "{
            \":status\": {\"S\": \"failure\"},
            \":error\": {\"S\": \"CDK rollback failed\"}
        }" > /dev/null 2>&1
    
    exit 1
fi

# Git 상태 복원 (커밋 기반 롤백인 경우)
if [ "$TARGET_COMMIT" != "unknown" ]; then
    git checkout "$CURRENT_BRANCH"
    git branch -D "$TEMP_BRANCH"
    log_info "Git 상태 복원 완료"
fi

# 6. 롤백 후 헬스체크
log_info "롤백 후 헬스체크 시작..."

# API 엔드포인트 추출
API_ENDPOINT=""
if [ -f outputs.json ]; then
    API_ENDPOINT=$(cat outputs.json | jq -r ".\"HanbitTodoStack-$ENVIRONMENT\".\"ApiEndpoint${ENVIRONMENT^}\" // empty")
fi

if [ -z "$API_ENDPOINT" ]; then
    # CloudFormation에서 추출
    API_ENDPOINT=$(aws cloudformation describe-stacks \
        --region "$AWS_REGION" \
        --stack-name "HanbitTodoStack-$ENVIRONMENT" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint${ENVIRONMENT^}'].OutputValue" \
        --output text)
fi

if [ -n "$API_ENDPOINT" ]; then
    log_info "API 엔드포인트: $API_ENDPOINT"
    
    # 헬스체크 수행 (최대 3분 대기)
    HEALTH_CHECK_SUCCESS=false
    
    for i in {1..18}; do
        log_info "헬스체크 시도 $i/18"
        
        if curl -f --max-time 10 "${API_ENDPOINT}/health" > /dev/null 2>&1; then
            log_success "헬스체크 성공"
            HEALTH_CHECK_SUCCESS=true
            break
        fi
        
        if [ $i -eq 18 ]; then
            log_error "헬스체크 실패"
            break
        fi
        
        sleep 10
    done
else
    log_warning "API 엔드포인트를 찾을 수 없어 헬스체크를 건너뜁니다."
    HEALTH_CHECK_SUCCESS=true
fi

# 7. 롤백 완료 기록
if [ "$HEALTH_CHECK_SUCCESS" = true ]; then
    log_info "롤백 성공 기록 중..."
    
    aws dynamodb update-item \
        --region "$AWS_REGION" \
        --table-name "deployment-history-$ENVIRONMENT" \
        --key "{
            \"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"},
            \"timestamp\": {\"S\": \"$(aws dynamodb get-item --table-name deployment-history-$ENVIRONMENT --key "{\"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"}}" --query 'Item.timestamp.S' --output text)\""}
        }" \
        --update-expression "SET #status = :status, duration = :duration, details = :details" \
        --expression-attribute-names "{\"#status\": \"status\"}" \
        --expression-attribute-values "{
            \":status\": {\"S\": \"success\"},
            \":duration\": {\"N\": \"$DEPLOY_DURATION\"},
            \":details\": {\"S\": \"{\\\"rollbackTarget\\\": \\\"$ROLLBACK_TARGET\\\", \\\"backupId\\\": \\\"$CURRENT_DEPLOYMENT_ID\\\", \\\"healthCheckPassed\\\": true, \\\"deployDuration\\\": $DEPLOY_DURATION}\"}
        }" > /dev/null 2>&1
    
    log_success "롤백 성공 기록 완료"
else
    log_error "헬스체크 실패로 인한 롤백 실패 기록..."
    
    aws dynamodb update-item \
        --region "$AWS_REGION" \
        --table-name "deployment-history-$ENVIRONMENT" \
        --key "{
            \"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"},
            \"timestamp\": {\"S\": \"$(aws dynamodb get-item --table-name deployment-history-$ENVIRONMENT --key "{\"deploymentId\": {\"S\": \"$ROLLBACK_DEPLOYMENT_ID\"}}" --query 'Item.timestamp.S' --output text)\""}
        }" \
        --update-expression "SET #status = :status, errorMessage = :error, details = :details" \
        --expression-attribute-names "{\"#status\": \"status\"}" \
        --expression-attribute-values "{
            \":status\": {\"S\": \"failure\"},
            \":error\": {\"S\": \"Health check failed after rollback\"},
            \":details\": {\"S\": \"{\\\"rollbackTarget\\\": \\\"$ROLLBACK_TARGET\\\", \\\"backupId\\\": \\\"$CURRENT_DEPLOYMENT_ID\\\", \\\"healthCheckPassed\\\": false}\"}
        }" > /dev/null 2>&1
fi

# 8. 완료 알림
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    log_info "롤백 완료 알림 전송 중..."
    
    if [ "$HEALTH_CHECK_SUCCESS" = true ]; then
        ALERT_COLOR="good"
        ALERT_TEXT="✅ 배포 롤백 성공"
    else
        ALERT_COLOR="danger"
        ALERT_TEXT="❌ 배포 롤백 실패"
    fi
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"text\": \"$ALERT_TEXT\",
            \"attachments\": [{
                \"color\": \"$ALERT_COLOR\",
                \"fields\": [
                    {\"title\": \"환경\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                    {\"title\": \"롤백 ID\", \"value\": \"$ROLLBACK_DEPLOYMENT_ID\", \"short\": true},
                    {\"title\": \"롤백 대상\", \"value\": \"$ROLLBACK_TARGET\", \"short\": true},
                    {\"title\": \"소요시간\", \"value\": \"${DEPLOY_DURATION}초\", \"short\": true},
                    {\"title\": \"헬스체크\", \"value\": \"$([ "$HEALTH_CHECK_SUCCESS" = true ] && echo '성공' || echo '실패')\", \"short\": true}
                ]
            }]
        }" \
        "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
    
    log_success "롤백 완료 알림 전송 완료"
fi

# 9. 정리
rm -f outputs.json

if [ "$HEALTH_CHECK_SUCCESS" = true ]; then
    log_success "배포 롤백이 성공적으로 완료되었습니다!"
    echo
    log_info "롤백 정보:"
    log_info "  - 롤백 ID: $ROLLBACK_DEPLOYMENT_ID"
    log_info "  - 롤백 대상: $ROLLBACK_TARGET"
    log_info "  - 백업 ID: $CURRENT_DEPLOYMENT_ID"
    log_info "  - 소요시간: ${DEPLOY_DURATION}초"
    echo
    log_info "CloudWatch 대시보드에서 시스템 상태를 모니터링하세요."
    exit 0
else
    log_error "배포 롤백이 실패했습니다!"
    echo
    log_error "즉시 시스템 상태를 확인하고 수동 개입이 필요할 수 있습니다."
    exit 1
fi