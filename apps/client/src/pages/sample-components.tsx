import React, { useState } from 'react';
import { 
  LinearButton, 
  LinearCard, 
  LinearCardContent, 
  LinearCardDescription, 
  LinearCardFooter, 
  LinearCardHeader, 
  LinearCardTitle,
  LinearInput 
} from '@hanbit/ui';

/**
 * Linear Design System 컴포넌트 데모 페이지
 * 모든 컴포넌트의 다양한 변형과 상태를 보여줍니다
 */

export function SampleComponents() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadingDemo = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
      <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const HeartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="space-y-12">
      {/* 페이지 헤더 */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[#f7f8f8]">
          Linear Design System
        </h1>
        <p className="text-lg text-white/70 max-w-2xl mx-auto">
          프로젝트 전반에서 사용할 수 있는 재사용 가능한 컴포넌트 라이브러리입니다.
          글래스모피즘 효과와 Linear.app에서 영감을 받은 디자인을 적용했습니다.
        </p>
      </div>

      {/* Button 컴포넌트 섹션 */}
      <LinearCard variant="glass">
        <LinearCardHeader>
          <LinearCardTitle>Button 컴포넌트</LinearCardTitle>
          <LinearCardDescription>
            다양한 변형과 상태를 지원하는 버튼 컴포넌트입니다.
          </LinearCardDescription>
        </LinearCardHeader>
        <LinearCardContent className="space-y-6">
          {/* 기본 변형들 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">Variants</h4>
            <div className="flex flex-wrap gap-3">
              <LinearButton variant="primary">Primary</LinearButton>
              <LinearButton variant="secondary">Secondary</LinearButton>
              <LinearButton variant="ghost">Ghost</LinearButton>
              <LinearButton variant="success">Success</LinearButton>
              <LinearButton variant="error">Error</LinearButton>
              <LinearButton variant="warning">Warning</LinearButton>
              <LinearButton variant="info">Info</LinearButton>
            </div>
          </div>

          {/* 크기 변형들 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">Sizes</h4>
            <div className="flex flex-wrap items-center gap-3">
              <LinearButton size="sm">Small</LinearButton>
              <LinearButton size="default">Default</LinearButton>
              <LinearButton size="lg">Large</LinearButton>
            </div>
          </div>

          {/* 아이콘과 상태 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">With Icons & States</h4>
            <div className="flex flex-wrap gap-3">
              <LinearButton icon={<PlusIcon />} iconPosition="left">
                Add Item
              </LinearButton>
              <LinearButton variant="secondary" icon={<SearchIcon />} iconPosition="right">
                Search
              </LinearButton>
              <LinearButton 
                variant="success" 
                loading={isLoading} 
                onClick={handleLoadingDemo}
              >
                {isLoading ? 'Loading...' : 'Click me'}
              </LinearButton>
              <LinearButton disabled>Disabled</LinearButton>
              <LinearButton fullWidth variant="ghost">
                Full Width Button
              </LinearButton>
            </div>
          </div>
        </LinearCardContent>
      </LinearCard>

      {/* Card 컴포넌트 섹션 */}
      <LinearCard variant="glass">
        <LinearCardHeader>
          <LinearCardTitle>Card 컴포넌트</LinearCardTitle>
          <LinearCardDescription>
            글래스모피즘 효과를 포함한 다양한 카드 스타일을 제공합니다.
          </LinearCardDescription>
        </LinearCardHeader>
        <LinearCardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Default Card */}
            <LinearCard variant="default" padding="default">
              <LinearCardHeader>
                <LinearCardTitle>Default Card</LinearCardTitle>
                <LinearCardDescription>
                  기본 카드 스타일입니다.
                </LinearCardDescription>
              </LinearCardHeader>
              <LinearCardContent>
                <p className="text-sm text-white/70">
                  이 카드는 기본적인 글래스모피즘 효과를 적용했습니다.
                </p>
              </LinearCardContent>
            </LinearCard>

            {/* Elevated Card */}
            <LinearCard variant="elevated" padding="default">
              <LinearCardHeader>
                <LinearCardTitle>Elevated Card</LinearCardTitle>
                <LinearCardDescription>
                  호버 효과가 있는 카드입니다.
                </LinearCardDescription>
              </LinearCardHeader>
              <LinearCardContent>
                <p className="text-sm text-white/70">
                  마우스를 올리면 배경이 변경됩니다.
                </p>
              </LinearCardContent>
            </LinearCard>

            {/* Interactive Card */}
            <LinearCard variant="glass" padding="default" interactive>
              <LinearCardHeader>
                <LinearCardTitle>Interactive Card</LinearCardTitle>
                <LinearCardDescription>
                  클릭 가능한 카드입니다.
                </LinearCardDescription>
              </LinearCardHeader>
              <LinearCardContent>
                <p className="text-sm text-white/70">
                  클릭하면 약간 위로 올라갑니다.
                </p>
              </LinearCardContent>
              <LinearCardFooter>
                <LinearButton size="sm" icon={<HeartIcon />}>
                  Like
                </LinearButton>
              </LinearCardFooter>
            </LinearCard>

            {/* Solid Card */}
            <LinearCard variant="solid" padding="default">
              <LinearCardHeader>
                <LinearCardTitle>Solid Card</LinearCardTitle>
                <LinearCardDescription>
                  단색 배경의 카드입니다.
                </LinearCardDescription>
              </LinearCardHeader>
              <LinearCardContent>
                <p className="text-sm text-white/70">
                  불투명한 배경을 사용합니다.
                </p>
              </LinearCardContent>
            </LinearCard>

            {/* Ghost Card */}
            <LinearCard variant="ghost" padding="default">
              <LinearCardHeader>
                <LinearCardTitle>Ghost Card</LinearCardTitle>
                <LinearCardDescription>
                  투명한 배경의 카드입니다.
                </LinearCardDescription>
              </LinearCardHeader>
              <LinearCardContent>
                <p className="text-sm text-white/70">
                  최소한의 배경을 사용합니다.
                </p>
              </LinearCardContent>
            </LinearCard>

            {/* Large Card */}
            <LinearCard variant="glass" padding="lg">
              <LinearCardHeader>
                <LinearCardTitle>Large Padding</LinearCardTitle>
                <LinearCardDescription>
                  큰 패딩을 적용한 카드입니다.
                </LinearCardDescription>
              </LinearCardHeader>
              <LinearCardContent>
                <p className="text-sm text-white/70">
                  더 넓은 공간을 제공합니다.
                </p>
              </LinearCardContent>
            </LinearCard>
          </div>
        </LinearCardContent>
      </LinearCard>

      {/* Input 컴포넌트 섹션 */}
      <LinearCard variant="glass">
        <LinearCardHeader>
          <LinearCardTitle>Input 컴포넌트</LinearCardTitle>
          <LinearCardDescription>
            다양한 상태와 스타일을 지원하는 입력 컴포넌트입니다.
          </LinearCardDescription>
        </LinearCardHeader>
        <LinearCardContent className="space-y-6">
          {/* 기본 변형들 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">Variants</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LinearInput 
                placeholder="Default input"
                variant="default"
              />
              <LinearInput 
                placeholder="Ghost input"
                variant="ghost"
              />
              <LinearInput 
                placeholder="Solid input"
                variant="solid"
              />
            </div>
          </div>

          {/* 크기들 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">Sizes</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LinearInput 
                placeholder="Small input"
                size="sm"
              />
              <LinearInput 
                placeholder="Default input"
                size="default"
              />
              <LinearInput 
                placeholder="Large input"
                size="lg"
              />
            </div>
          </div>

          {/* 상태들 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">States</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LinearInput 
                label="성공 상태"
                placeholder="입력해주세요"
                state="success"
                helperText="올바르게 입력되었습니다."
              />
              <LinearInput 
                label="에러 상태"
                placeholder="입력해주세요"
                errorMessage="필수 입력 항목입니다."
              />
              <LinearInput 
                label="경고 상태"
                placeholder="입력해주세요"
                state="warning"
                helperText="주의가 필요합니다."
              />
              <LinearInput 
                label="비활성화"
                placeholder="입력할 수 없습니다"
                disabled
              />
            </div>
          </div>

          {/* 아이콘과 기능들 */}
          <div>
            <h4 className="text-sm font-medium text-[#f7f8f8] mb-3">With Icons</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LinearInput 
                label="검색"
                placeholder="검색어를 입력하세요"
                startIcon={<SearchIcon />}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <LinearInput 
                label="좋아요"
                placeholder="메시지를 입력하세요"
                endIcon={<HeartIcon />}
              />
            </div>
          </div>
        </LinearCardContent>
      </LinearCard>

      {/* 사용 예제 */}
      <LinearCard variant="solid">
        <LinearCardHeader>
          <LinearCardTitle>실제 사용 예제</LinearCardTitle>
          <LinearCardDescription>
            여러 컴포넌트를 조합한 실제 사용 사례입니다.
          </LinearCardDescription>
        </LinearCardHeader>
        <LinearCardContent>
          <div className="max-w-md mx-auto">
            <form className="space-y-4">
              <LinearInput 
                label="이메일"
                type="email"
                placeholder="your@email.com"
                required
              />
              <LinearInput 
                label="비밀번호"
                type="password"
                placeholder="••••••••"
                required
              />
              <div className="flex gap-3">
                <LinearButton type="submit" fullWidth>
                  로그인
                </LinearButton>
                <LinearButton variant="secondary" type="button">
                  취소
                </LinearButton>
              </div>
            </form>
          </div>
        </LinearCardContent>
      </LinearCard>
    </div>
  );
}