#!/bin/bash

# Hanbit TODO 앱 시크릿 관리 스크립트
# AWS Parameter Store와 Secrets Manager를 통한 시크릿 관리

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 로그 함수들
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

# 사용법 출력
usage() {
    echo "사용법: $0 <command> <environment> [options]"
    echo ""
    echo "명령어:"
    echo "  list         시크릿 목록 조회"
    echo "  get          시크릿 값 조회"
    echo "  set          시크릿 값 설정"
    echo "  update       시크릿 값 업데이트"
    echo "  delete       시크릿 삭제"
    echo "  rotate       JWT 시크릿 로테이션"
    echo "  validate     시크릿 유효성 검사"
    echo "  sync-env     환경 변수를 프론트엔드 .env 파일에 동기화"
    echo ""
    echo "환경:"
    echo "  dev      개발 환경"
    echo "  test     테스트 환경"
    echo "  prod     프로덕션 환경"
    echo ""
    echo "옵션:"
    echo "  --secret-name <name>     시크릿 이름 지정"
    echo "  --secret-value <value>   시크릿 값 지정"
    echo "  --parameter-name <name>  Parameter Store 이름 지정"
    echo "  --parameter-value <val>  Parameter 값 지정"
    echo ""
    echo "예시:"
    echo "  $0 list dev                           # 개발 환경의 모든 시크릿 목록"
    echo "  $0 get dev --secret-name jwt-secret   # JWT 시크릿 값 조회"
    echo "  $0 set prod --secret-name api-key --secret-value 'new-key'  # API 키 설정"
    echo "  $0 rotate prod                        # 프로덕션 JWT 시크릿 로테이션"
    echo "  $0 sync-env prod                      # 프로덕션 환경 변수 동기화"
}

# 환경 검증
validate_environment() {
    case $1 in
        dev|test|prod)
            return 0
            ;;
        *)
            log_error "유효하지 않은 환경: $1"
            exit 1
            ;;
    esac
}

# AWS 자격증명 확인
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS 자격증명이 설정되어 있지 않습니다."
        exit 1
    fi
}

# 시크릿 목록 조회
list_secrets() {
    local env=$1
    local prefix="/hanbit-todo/$env"
    
    log_info "$env 환경의 시크릿 목록:"
    echo ""
    
    # Secrets Manager 시크릿들
    log_info "=== Secrets Manager ==="
    aws secretsmanager list-secrets \
        --filters Key=name,Values="$prefix" \
        --query 'SecretList[*].[Name,Description]' \
        --output table
    
    echo ""
    
    # Parameter Store 파라미터들
    log_info "=== Parameter Store ==="
    aws ssm describe-parameters \
        --parameter-filters "Key=Name,Option=BeginsWith,Values=$prefix" \
        --query 'Parameters[*].[Name,Description,Type]' \
        --output table
}

# 시크릿 값 조회
get_secret() {
    local env=$1
    local secret_name=$2
    local parameter_name=$3
    
    if [[ -n "$secret_name" ]]; then
        log_info "Secrets Manager에서 시크릿 조회: $secret_name"
        aws secretsmanager get-secret-value \
            --secret-id "/hanbit-todo/$env/$secret_name" \
            --query 'SecretString' \
            --output text | jq .
    elif [[ -n "$parameter_name" ]]; then
        log_info "Parameter Store에서 파라미터 조회: $parameter_name"
        aws ssm get-parameter \
            --name "/hanbit-todo/$env/$parameter_name" \
            --with-decryption \
            --query 'Parameter.Value' \
            --output text
    else
        log_error "시크릿 이름 또는 파라미터 이름을 지정해주세요."
        exit 1
    fi
}

# 시크릿 값 설정
set_secret() {
    local env=$1
    local secret_name=$2
    local secret_value=$3
    local parameter_name=$4
    local parameter_value=$5
    
    if [[ -n "$secret_name" && -n "$secret_value" ]]; then
        log_info "Secrets Manager에 시크릿 생성/업데이트: $secret_name"
        
        # 시크릿 존재 여부 확인
        if aws secretsmanager describe-secret --secret-id "/hanbit-todo/$env/$secret_name" &> /dev/null; then
            # 업데이트
            aws secretsmanager update-secret \
                --secret-id "/hanbit-todo/$env/$secret_name" \
                --secret-string "$secret_value"
            log_success "시크릿이 업데이트되었습니다."
        else
            # 생성
            aws secretsmanager create-secret \
                --name "/hanbit-todo/$env/$secret_name" \
                --description "Manual secret for $env environment" \
                --secret-string "$secret_value"
            log_success "시크릿이 생성되었습니다."
        fi
        
    elif [[ -n "$parameter_name" && -n "$parameter_value" ]]; then
        log_info "Parameter Store에 파라미터 설정: $parameter_name"
        
        aws ssm put-parameter \
            --name "/hanbit-todo/$env/$parameter_name" \
            --value "$parameter_value" \
            --type "SecureString" \
            --overwrite
        log_success "파라미터가 설정되었습니다."
        
    else
        log_error "시크릿 이름과 값, 또는 파라미터 이름과 값을 지정해주세요."
        exit 1
    fi
}

# 시크릿 삭제
delete_secret() {
    local env=$1
    local secret_name=$2
    local parameter_name=$3
    
    if [[ -n "$secret_name" ]]; then
        log_warning "Secrets Manager에서 시크릿 삭제: $secret_name"
        read -p "정말로 삭제하시겠습니까? (yes/NO): " -r
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            aws secretsmanager delete-secret \
                --secret-id "/hanbit-todo/$env/$secret_name" \
                --force-delete-without-recovery
            log_success "시크릿이 삭제되었습니다."
        else
            log_info "삭제가 취소되었습니다."
        fi
        
    elif [[ -n "$parameter_name" ]]; then
        log_warning "Parameter Store에서 파라미터 삭제: $parameter_name"
        read -p "정말로 삭제하시겠습니까? (yes/NO): " -r
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            aws ssm delete-parameter \
                --name "/hanbit-todo/$env/$parameter_name"
            log_success "파라미터가 삭제되었습니다."
        else
            log_info "삭제가 취소되었습니다."
        fi
        
    else
        log_error "시크릿 이름 또는 파라미터 이름을 지정해주세요."
        exit 1
    fi
}

# JWT 시크릿 로테이션
rotate_jwt_secret() {
    local env=$1
    local secret_name="/hanbit-todo/$env/jwt-secret"
    
    log_warning "$env 환경의 JWT 시크릿을 로테이션합니다."
    log_warning "이 작업은 모든 기존 JWT 토큰을 무효화시킵니다!"
    
    if [[ "$env" == "prod" ]]; then
        read -p "프로덕션 환경에서 JWT 시크릿을 로테이션하시겠습니까? (yes/NO): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "로테이션이 취소되었습니다."
            exit 0
        fi
    fi
    
    log_info "JWT 시크릿 로테이션 중..."
    aws secretsmanager rotate-secret \
        --secret-id "$secret_name" \
        --rotation-rules AutomaticallyAfterDays=90
    
    log_success "JWT 시크릿이 로테이션되었습니다."
    log_warning "애플리케이션을 재배포하여 새 시크릿을 적용해주세요."
}

# 시크릿 유효성 검사
validate_secrets() {
    local env=$1
    local prefix="/hanbit-todo/$env"
    local errors=0
    
    log_info "$env 환경의 시크릿 유효성 검사 중..."
    
    # 필수 시크릿들 확인
    local required_secrets=(
        "jwt-secret"
        "api-keys"
    )
    
    local required_parameters=(
        "db-encryption-key"
        "app-config"
        "database-config"
        "notification-settings"
    )
    
    # Secrets Manager 확인
    for secret in "${required_secrets[@]}"; do
        if aws secretsmanager describe-secret --secret-id "$prefix/$secret" &> /dev/null; then
            log_success "✓ Secrets Manager: $secret"
        else
            log_error "✗ Secrets Manager: $secret (누락됨)"
            ((errors++))
        fi
    done
    
    # Parameter Store 확인
    for param in "${required_parameters[@]}"; do
        if aws ssm get-parameter --name "$prefix/$param" &> /dev/null; then
            log_success "✓ Parameter Store: $param"
        else
            log_error "✗ Parameter Store: $param (누락됨)"
            ((errors++))
        fi
    done
    
    # 결과 요약
    if [[ $errors -eq 0 ]]; then
        log_success "모든 필수 시크릿이 존재합니다."
    else
        log_error "$errors개의 시크릿이 누락되었습니다."
        log_info "누락된 시크릿을 생성하려면 CDK 배포를 실행하세요."
        exit 1
    fi
}

# 환경 변수를 프론트엔드 .env 파일에 동기화
sync_environment_vars() {
    local env=$1
    local stack_name="HanbitTodoStack-$(echo $env | sed 's/^./\U&/g')"  # 첫 글자 대문자로 변환
    local env_file=""
    
    # 환경별 .env 파일 결정
    case $env in
        dev)
            env_file="../../client/.env.development"
            ;;
        test)
            env_file="../../client/.env.test"
            ;;
        prod)
            env_file="../../client/.env.production"
            ;;
        *)
            log_error "지원하지 않는 환경: $env"
            exit 1
            ;;
    esac
    
    log_info "$env 환경의 리소스 정보를 $env_file 파일에 동기화합니다..."
    
    # CloudFormation 스택에서 출력값 가져오기
    if ! aws cloudformation describe-stacks --stack-name "$stack_name" &> /dev/null; then
        log_error "스택 '$stack_name'을 찾을 수 없습니다. 먼저 배포를 실행해주세요."
        exit 1
    fi
    
    # 스택 출력값 가져오기
    local api_endpoint=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint$env'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    local user_pool_id=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolId$env'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    local user_pool_client_id=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId$env'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    local identity_pool_id=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId$env'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    # .env 파일 백업 생성
    if [[ -f "$env_file" ]]; then
        cp "$env_file" "$env_file.backup.$(date +%Y%m%d_%H%M%S)"
        log_info ".env 파일을 백업했습니다: $env_file.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # .env 파일 업데이트
    if [[ -f "$env_file" ]]; then
        # 기존 파일에서 AWS 리소스 관련 환경 변수 업데이트
        if [[ -n "$api_endpoint" ]]; then
            if grep -q "VITE_API_BASE_URL=" "$env_file"; then
                sed -i.tmp "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$api_endpoint|g" "$env_file"
                rm -f "$env_file.tmp"
                log_success "API_BASE_URL 업데이트됨: $api_endpoint"
            else
                echo "VITE_API_BASE_URL=$api_endpoint" >> "$env_file"
                log_success "API_BASE_URL 추가됨: $api_endpoint"
            fi
        fi
        
        if [[ -n "$user_pool_id" ]]; then
            if grep -q "VITE_COGNITO_USER_POOL_ID=" "$env_file"; then
                sed -i.tmp "s|VITE_COGNITO_USER_POOL_ID=.*|VITE_COGNITO_USER_POOL_ID=$user_pool_id|g" "$env_file"
                rm -f "$env_file.tmp"
            else
                echo "VITE_COGNITO_USER_POOL_ID=$user_pool_id" >> "$env_file"
            fi
            log_success "USER_POOL_ID 업데이트됨: $user_pool_id"
        fi
        
        if [[ -n "$user_pool_client_id" ]]; then
            if grep -q "VITE_COGNITO_USER_POOL_CLIENT_ID=" "$env_file"; then
                sed -i.tmp "s|VITE_COGNITO_USER_POOL_CLIENT_ID=.*|VITE_COGNITO_USER_POOL_CLIENT_ID=$user_pool_client_id|g" "$env_file"
                rm -f "$env_file.tmp"
            else
                echo "VITE_COGNITO_USER_POOL_CLIENT_ID=$user_pool_client_id" >> "$env_file"
            fi
            log_success "USER_POOL_CLIENT_ID 업데이트됨: $user_pool_client_id"
        fi
        
        if [[ -n "$identity_pool_id" ]]; then
            if grep -q "VITE_COGNITO_IDENTITY_POOL_ID=" "$env_file"; then
                sed -i.tmp "s|VITE_COGNITO_IDENTITY_POOL_ID=.*|VITE_COGNITO_IDENTITY_POOL_ID=$identity_pool_id|g" "$env_file"
                rm -f "$env_file.tmp"
            else
                echo "VITE_COGNITO_IDENTITY_POOL_ID=$identity_pool_id" >> "$env_file"
            fi
            log_success "IDENTITY_POOL_ID 업데이트됨: $identity_pool_id"
        fi
        
        log_success "환경 변수 동기화가 완료되었습니다: $env_file"
        log_info "변경된 내용을 확인하려면 다음 명령어를 실행하세요:"
        log_info "  cat $env_file"
        
    else
        log_error ".env 파일이 존재하지 않습니다: $env_file"
        exit 1
    fi
}

# 메인 함수
main() {
    local command=""
    local environment=""
    local secret_name=""
    local secret_value=""
    local parameter_name=""
    local parameter_value=""
    
    # 파라미터 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            list|get|set|update|delete|rotate|validate|sync-env)
                command=$1
                shift
                ;;
            dev|test|prod)
                environment=$1
                shift
                ;;
            --secret-name)
                secret_name=$2
                shift 2
                ;;
            --secret-value)
                secret_value=$2
                shift 2
                ;;
            --parameter-name)
                parameter_name=$2
                shift 2
                ;;
            --parameter-value)
                parameter_value=$2
                shift 2
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                log_error "알 수 없는 옵션: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # 필수 파라미터 확인
    if [[ -z "$command" || -z "$environment" ]]; then
        log_error "명령어와 환경을 지정해주세요."
        usage
        exit 1
    fi
    
    # 검증
    validate_environment "$environment"
    check_aws_credentials
    
    # 명령어 실행
    case $command in
        list)
            list_secrets "$environment"
            ;;
        get)
            get_secret "$environment" "$secret_name" "$parameter_name"
            ;;
        set|update)
            set_secret "$environment" "$secret_name" "$secret_value" "$parameter_name" "$parameter_value"
            ;;
        delete)
            delete_secret "$environment" "$secret_name" "$parameter_name"
            ;;
        rotate)
            rotate_jwt_secret "$environment"
            ;;
        validate)
            validate_secrets "$environment"
            ;;
        sync-env)
            sync_environment_vars "$environment"
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            usage
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"