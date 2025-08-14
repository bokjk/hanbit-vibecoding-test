#!/bin/bash

# 배포 메트릭 수집 및 리포팅 스크립트
# 사용법: ./deployment-metrics.sh [환경] [기간(일)]

set -e

# 기본값 설정
ENVIRONMENT=${1:-"prod"}
PERIOD_DAYS=${2:-"30"}
AWS_REGION=${AWS_REGION:-"ap-northeast-2"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="reports"

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

# 스크립트 시작
log_info "배포 메트릭 수집 시작"
log_info "환경: $ENVIRONMENT"
log_info "기간: $PERIOD_DAYS 일"
log_info "리전: $AWS_REGION"

# 리포트 디렉토리 생성
mkdir -p "$REPORT_DIR"

# 1. 배포 통계 수집
log_info "배포 통계 수집 중..."

STATS_OUTPUT=$(aws lambda invoke \
    --region "$AWS_REGION" \
    --function-name "HanbitTodoStack-${ENVIRONMENT}-DeploymentHistory-DeploymentStatsFunction" \
    --payload "{\"queryStringParameters\": {\"period\": \"$PERIOD_DAYS\", \"includeDetails\": \"true\"}}" \
    --output json \
    response.json 2>/dev/null && cat response.json | jq -r '.body' | jq . || echo "{}")

if [ "$STATS_OUTPUT" = "{}" ]; then
    log_error "배포 통계 수집 실패"
    exit 1
fi

echo "$STATS_OUTPUT" > "$REPORT_DIR/deployment-stats-${ENVIRONMENT}-${TIMESTAMP}.json"
log_success "배포 통계 저장: $REPORT_DIR/deployment-stats-${ENVIRONMENT}-${TIMESTAMP}.json"

# 2. CloudWatch 메트릭 수집
log_info "CloudWatch 메트릭 수집 중..."

# 시작 시간과 종료 시간 계산
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
START_TIME=$(date -u -d "$PERIOD_DAYS days ago" +"%Y-%m-%dT%H:%M:%S")

# Lambda 함수별 에러율 및 성능 메트릭
LAMBDA_FUNCTIONS=("CreateTodo" "GetTodos" "UpdateTodo" "DeleteTodo" "AuthLogin" "AuthRegister")

echo "{" > "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "  \"period\": \"$PERIOD_DAYS days\"," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "  \"startTime\": \"$START_TIME\"," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "  \"endTime\": \"$END_TIME\"," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "  \"lambdaMetrics\": {" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"

for i in "${!LAMBDA_FUNCTIONS[@]}"; do
    FUNCTION_NAME="${LAMBDA_FUNCTIONS[$i]}"
    FULL_FUNCTION_NAME="HanbitTodoStack-${ENVIRONMENT}-Lambda-${FUNCTION_NAME}Function"
    
    log_info "Lambda 함수 메트릭 수집: $FUNCTION_NAME"
    
    # 에러 수 조회
    ERRORS=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/Lambda" \
        --metric-name "Errors" \
        --dimensions Name=FunctionName,Value="$FULL_FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[].Sum' \
        --output json | jq 'add // 0')
    
    # 호출 수 조회
    INVOCATIONS=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/Lambda" \
        --metric-name "Invocations" \
        --dimensions Name=FunctionName,Value="$FULL_FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[].Sum' \
        --output json | jq 'add // 0')
    
    # 평균 응답 시간 조회
    DURATION=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/Lambda" \
        --metric-name "Duration" \
        --dimensions Name=FunctionName,Value="$FULL_FUNCTION_NAME" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --period 3600 \
        --statistics Average \
        --query 'Datapoints[].Average' \
        --output json | jq '[.[] // 0] | add / length')
    
    # JSON에 추가
    echo "    \"$FUNCTION_NAME\": {" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
    echo "      \"errors\": $ERRORS," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
    echo "      \"invocations\": $INVOCATIONS," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
    echo "      \"averageDuration\": $DURATION" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
    
    if [ $i -eq $((${#LAMBDA_FUNCTIONS[@]} - 1)) ]; then
        echo "    }" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
    else
        echo "    }," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
    fi
done

# API Gateway 메트릭
log_info "API Gateway 메트릭 수집 중..."

API_ERRORS=$(aws cloudwatch get-metric-statistics \
    --namespace "AWS/ApiGateway" \
    --metric-name "5XXError" \
    --dimensions Name=ApiName,Value="hanbit-todo-api-${ENVIRONMENT}" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --query 'Datapoints[].Sum' \
    --output json | jq 'add // 0')

API_REQUESTS=$(aws cloudwatch get-metric-statistics \
    --namespace "AWS/ApiGateway" \
    --metric-name "Count" \
    --dimensions Name=ApiName,Value="hanbit-todo-api-${ENVIRONMENT}" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --query 'Datapoints[].Sum' \
    --output json | jq 'add // 0')

API_LATENCY=$(aws cloudwatch get-metric-statistics \
    --namespace "AWS/ApiGateway" \
    --metric-name "Latency" \
    --dimensions Name=ApiName,Value="hanbit-todo-api-${ENVIRONMENT}" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Average \
    --query 'Datapoints[].Average' \
    --output json | jq '[.[] // 0] | add / length')

echo "  }," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "  \"apiGatewayMetrics\": {" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "    \"errors\": $API_ERRORS," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "    \"requests\": $API_REQUESTS," >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "    \"averageLatency\": $API_LATENCY" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "  }" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"
echo "}" >> "$REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"

log_success "CloudWatch 메트릭 저장: $REPORT_DIR/cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json"

# 3. 알람 상태 확인
log_info "알람 상태 확인 중..."

ALARM_STATUS=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "HanbitTodoStack-${ENVIRONMENT}" \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Reason:StateReason}' \
    --output json)

echo "$ALARM_STATUS" > "$REPORT_DIR/alarm-status-${ENVIRONMENT}-${TIMESTAMP}.json"
log_success "알람 상태 저장: $REPORT_DIR/alarm-status-${ENVIRONMENT}-${TIMESTAMP}.json"

# 4. 리포트 요약 생성
log_info "요약 리포트 생성 중..."

# 배포 통계에서 핵심 지표 추출
TOTAL_DEPLOYMENTS=$(echo "$STATS_OUTPUT" | jq -r '.stats.totalDeployments')
SUCCESS_RATE=$(echo "$STATS_OUTPUT" | jq -r '.stats.successRate')
FAILED_DEPLOYMENTS=$(echo "$STATS_OUTPUT" | jq -r '.stats.failedDeployments')
AVERAGE_DURATION=$(echo "$STATS_OUTPUT" | jq -r '.stats.averageDuration')

# 알람 개수 계산
CRITICAL_ALARMS=$(echo "$ALARM_STATUS" | jq '[.[] | select(.State == "ALARM")] | length')
OK_ALARMS=$(echo "$ALARM_STATUS" | jq '[.[] | select(.State == "OK")] | length')

# 요약 리포트 생성
cat > "$REPORT_DIR/deployment-summary-${ENVIRONMENT}-${TIMESTAMP}.md" << EOF
# 배포 메트릭 요약 리포트

**환경**: $ENVIRONMENT  
**기간**: $PERIOD_DAYS 일  
**생성일시**: $(date)

## 📊 핵심 지표

### 배포 성과
- **총 배포 횟수**: $TOTAL_DEPLOYMENTS
- **성공률**: $SUCCESS_RATE%
- **실패 배포**: $FAILED_DEPLOYMENTS
- **평균 배포 시간**: $AVERAGE_DURATION 초

### 시스템 상태
- **중요 알람**: $CRITICAL_ALARMS 개
- **정상 알람**: $OK_ALARMS 개
- **API 에러**: $API_ERRORS 건
- **API 요청**: $API_REQUESTS 건
- **평균 API 응답시간**: ${API_LATENCY} ms

## 🎯 권장사항

$(if [ "$SUCCESS_RATE" -lt 95 ]; then
    echo "⚠️ **배포 성공률이 95% 미만입니다. 배포 프로세스 개선이 필요합니다.**"
fi)

$(if [ "$CRITICAL_ALARMS" -gt 0 ]; then
    echo "🚨 **활성 알람이 $CRITICAL_ALARMS 개 있습니다. 즉시 확인이 필요합니다.**"
fi)

$(if [ "$AVERAGE_DURATION" -gt 300 ]; then
    echo "⏱️ **평균 배포 시간이 5분을 초과합니다. 배포 최적화를 고려해보세요.**"
fi)

## 📁 상세 파일

- 배포 통계: \`deployment-stats-${ENVIRONMENT}-${TIMESTAMP}.json\`
- CloudWatch 메트릭: \`cloudwatch-metrics-${ENVIRONMENT}-${TIMESTAMP}.json\`
- 알람 상태: \`alarm-status-${ENVIRONMENT}-${TIMESTAMP}.json\`

EOF

log_success "요약 리포트 생성: $REPORT_DIR/deployment-summary-${ENVIRONMENT}-${TIMESTAMP}.md"

# 5. Slack으로 요약 리포트 전송 (선택사항)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    log_info "Slack으로 요약 리포트 전송 중..."
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"text\": \"📊 배포 메트릭 리포트 ($ENVIRONMENT)\",
            \"attachments\": [{
                \"color\": \"$(if [ "$SUCCESS_RATE" -lt 95 ] || [ "$CRITICAL_ALARMS" -gt 0 ]; then echo 'warning'; else echo 'good'; fi)\",
                \"fields\": [
                    {\"title\": \"총 배포\", \"value\": \"$TOTAL_DEPLOYMENTS\", \"short\": true},
                    {\"title\": \"성공률\", \"value\": \"$SUCCESS_RATE%\", \"short\": true},
                    {\"title\": \"평균 시간\", \"value\": \"$AVERAGE_DURATION초\", \"short\": true},
                    {\"title\": \"활성 알람\", \"value\": \"$CRITICAL_ALARMS개\", \"short\": true}
                ]
            }]
        }" \
        "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
    
    log_success "Slack 알림 전송 완료"
fi

# 6. 정리
rm -f response.json

log_success "배포 메트릭 수집 완료!"
log_info "생성된 파일들:"
find "$REPORT_DIR" -name "*${ENVIRONMENT}-${TIMESTAMP}*" -type f | while read file; do
    echo "  - $file"
done

echo
echo -e "${GREEN}=== 요약 리포트 ====${NC}"
cat "$REPORT_DIR/deployment-summary-${ENVIRONMENT}-${TIMESTAMP}.md"