#!/bin/bash

# Hanbit TODO 앱 환경별 배포 스크립트
# 사용법: ./scripts/deploy.sh [dev|test|prod] [options]

set -e  # 에러 발생시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    echo "사용법: $0 <environment> [options]"
    echo ""
    echo "환경:"
    echo "  dev      개발 환경"
    echo "  test     테스트 환경"  
    echo "  prod     프로덕션 환경"
    echo ""
    echo "옵션:"
    echo "  --dry-run          실제 배포 없이 변경사항만 확인"
    echo "  --force-approval   프로덕션 배포시 승인 없이 진행"
    echo "  --skip-build       빌드 단계 건너뛰기"
    echo "  --skip-tests       테스트 단계 건너뛰기"
    echo "  --help             이 도움말 출력"
    echo ""
    echo "예시:"
    echo "  $0 dev                    # 개발 환경 배포"
    echo "  $0 prod --dry-run         # 프로덕션 변경사항 확인"
    echo "  $0 test --skip-tests      # 테스트 없이 테스트 환경 배포"
}

# 파라미터 검증
validate_environment() {
    case $1 in
        dev|test|prod)
            return 0
            ;;
        *)
            log_error "유효하지 않은 환경: $1"
            log_error "지원되는 환경: dev, test, prod"
            exit 1
            ;;
    esac
}

# AWS CLI 설치 확인
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI가 설치되어 있지 않습니다."
        log_info "AWS CLI 설치: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
}

# AWS 자격증명 확인
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS 자격증명이 설정되어 있지 않습니다."
        log_info "AWS 자격증명 설정: aws configure"
        exit 1
    else
        local account_id=$(aws sts get-caller-identity --query Account --output text)
        local region=$(aws configure get region)
        log_info "AWS 계정: $account_id"
        log_info "AWS 리전: $region"
    fi
}

# CDK 부트스트랩 확인
check_cdk_bootstrap() {
    local env=$1
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region)
    
    log_info "CDK 부트스트랩 상태 확인 중..."
    
    # 부트스트랩 스택 존재 여부 확인
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $region &> /dev/null; then
        log_warning "CDK 부트스트랩이 필요합니다."
        read -p "부트스트랩을 진행하시겠습니까? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "CDK 부트스트랩 진행 중..."
            npm run bootstrap
            log_success "CDK 부트스트랩 완료"
        else
            log_error "CDK 부트스트랩이 필요합니다."
            exit 1
        fi
    else
        log_success "CDK 부트스트랩 확인됨"
    fi
}

# 프로덕션 배포 확인
confirm_production_deployment() {
    if [[ "$1" == "prod" && "$2" != "--force-approval" ]]; then
        log_warning "프로덕션 환경에 배포하려고 합니다!"
        echo "이 작업은 실제 운영 환경에 영향을 줄 수 있습니다."
        read -p "계속 진행하시겠습니까? (yes/NO): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "배포가 취소되었습니다."
            exit 0
        fi
    fi
}

# 빌드 및 테스트
build_and_test() {
    if [[ "$SKIP_BUILD" != "true" ]]; then
        log_info "프로젝트 빌드 중..."
        npm run build
        log_success "빌드 완료"
    else
        log_warning "빌드 단계를 건너뛰었습니다."
    fi

    if [[ "$SKIP_TESTS" != "true" ]]; then
        log_info "테스트 실행 중..."
        npm run test -- --run
        log_success "테스트 완료"
    else
        log_warning "테스트 단계를 건너뛰었습니다."
    fi
}

# 배포 전 검증
pre_deployment_checks() {
    local env=$1
    
    log_info "배포 전 검증 중..."
    
    # CloudFormation 템플릿 생성
    log_info "CloudFormation 템플릿 생성 중..."
    npm run synth:$env
    
    # 변경사항 확인
    log_info "변경사항 확인 중..."
    npm run diff:$env || true  # diff 명령어가 변경사항이 있을 때 exit code 1을 반환하므로 무시
    
    log_success "배포 전 검증 완료"
}

# 실제 배포 실행
execute_deployment() {
    local env=$1
    local dry_run=$2
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run 모드: 실제 배포는 수행되지 않습니다."
        return 0
    fi
    
    log_info "$env 환경으로 배포 중..."
    
    # 환경별 배포 옵션 설정
    local deploy_cmd="npm run deploy:$env"
    
    # 배포 실행
    eval $deploy_cmd
    
    log_success "$env 환경 배포 완료!"
}

# 배포 후 검증
post_deployment_validation() {
    local env=$1
    
    log_info "배포 후 검증 중..."
    
    # 스택 상태 확인
    local stack_name="HanbitTodoStack-$(echo $env | sed 's/^./\U&/g')"  # 첫 글자 대문자로 변환
    local stack_status=$(aws cloudformation describe-stacks --stack-name $stack_name --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [[ "$stack_status" == "CREATE_COMPLETE" || "$stack_status" == "UPDATE_COMPLETE" ]]; then
        log_success "스택 상태: $stack_status"
        
        # 출력값 표시
        log_info "스택 출력값:"
        aws cloudformation describe-stacks --stack-name $stack_name --query 'Stacks[0].Outputs' --output table
        
        # 환경 변수 자동 동기화
        log_info "프론트엔드 환경 변수 자동 동기화 중..."
        if ./scripts/manage-secrets.sh sync-env $env; then
            log_success "환경 변수 동기화 완료"
        else
            log_warning "환경 변수 동기화 실패. 수동으로 실행해주세요:"
            log_info "  ./scripts/manage-secrets.sh sync-env $env"
        fi
        
    else
        log_error "스택 상태: $stack_status"
        log_error "배포가 실패했을 수 있습니다. AWS 콘솔에서 확인해주세요."
        exit 1
    fi
    
    log_success "배포 후 검증 완료"
}

# 메인 함수
main() {
    # 파라미터 파싱
    ENVIRONMENT=""
    DRY_RUN="false"
    FORCE_APPROVAL="false"
    SKIP_BUILD="false"
    SKIP_TESTS="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --force-approval)
                FORCE_APPROVAL="--force-approval"
                shift
                ;;
            --skip-build)
                SKIP_BUILD="true"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            dev|test|prod)
                ENVIRONMENT=$1
                shift
                ;;
            *)
                log_error "알 수 없는 옵션: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # 환경 파라미터 필수 체크
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "환경을 지정해주세요."
        usage
        exit 1
    fi
    
    # 스크립트 시작
    log_info "=== Hanbit TODO 앱 배포 시작 ==="
    log_info "환경: $ENVIRONMENT"
    log_info "Dry run: $DRY_RUN"
    
    # 검증 단계
    validate_environment "$ENVIRONMENT"
    check_aws_cli
    check_aws_credentials
    check_cdk_bootstrap "$ENVIRONMENT"
    confirm_production_deployment "$ENVIRONMENT" "$FORCE_APPROVAL"
    
    # 빌드 및 테스트
    build_and_test
    
    # 배포 전 검증
    pre_deployment_checks "$ENVIRONMENT"
    
    # 배포 실행
    execute_deployment "$ENVIRONMENT" "$DRY_RUN"
    
    # 배포 후 검증 (dry run이 아닐 때만)
    if [[ "$DRY_RUN" != "true" ]]; then
        post_deployment_validation "$ENVIRONMENT"
    fi
    
    log_success "=== 배포 완료 ==="
}

# 스크립트 실행
main "$@"