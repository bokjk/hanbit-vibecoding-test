import React, { useState } from "react";
import { Button, Input } from "@vive/ui";

interface TodoHeaderProps {
  onSearch?: (query: string) => void;
}

export function TodoHeader({ onSearch }: TodoHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <header
      data-testid="todo-header"
      style={{
        background: 'linear-gradient(to right, rgb(147 51 234), rgb(37 99 235), rgb(67 56 202))',
        color: 'white',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}
    >
      <div style={{
        maxWidth: '80rem',
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        <style>
          {`
            @media (min-width: 640px) {
              .header-main { padding-left: 1.5rem; padding-right: 1.5rem; }
            }
            @media (min-width: 1024px) {
              .header-main { padding-left: 2rem; padding-right: 2rem; }
            }
          `}
        </style>
        <div className="header-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
          {/* 왼쪽: 로고와 제목 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(4px)',
                padding: '0.75rem',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
              }}>
                <svg
                  style={{ height: '1.5rem', width: '1.5rem', color: 'white' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <div>
                <h1 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(to right, white, rgb(219 234 254))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  TaskFlow
                </h1>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'rgb(219 234 254)',
                  display: 'none',
                  '@media (min-width: 640px)': {
                    display: 'block'
                  }
                }}>
                  생산성을 위한 스마트 할 일 관리
                </p>
              </div>
            </div>
          </div>

          {/* 가운데: 검색 */}
          <div style={{
            display: 'none',
            flex: '1',
            maxWidth: '28rem',
            margin: '0 2rem'
          }} style={{ display: 'none', flex: '1', maxWidth: '28rem', margin: '0 2rem' }}>
            <style>
              {`
                @media (min-width: 768px) {
                  .search-container { display: flex !important; }
                }
              `}
            </style>
            <div className="search-container">
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                paddingLeft: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}>
                <svg
                  style={{ height: '1.25rem', width: '1.25rem', color: 'rgb(191 219 254)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <Input
                data-testid="search-input"
                type="text"
                placeholder="할 일 검색..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  paddingLeft: '2.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white'
                }}
              />
            </div>
            </div>
          </div>

          {/* 오른쪽: 액션 버튼들과 프로필 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* 테마 토글 */}
            <Button
              variant="ghost"
              size="sm"
              style={{
                color: 'white',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                transition: 'background-color 200ms ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              <svg
                style={{ height: '1.25rem', width: '1.25rem' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </Button>

            {/* 알림 */}
            <Button
              variant="ghost"
              size="sm"
              style={{
                color: 'white',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                position: 'relative',
                transition: 'background-color 200ms ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              <svg
                style={{ height: '1.25rem', width: '1.25rem' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-5 5v-5zM11 19H6a2 2 0 01-2-2V7a2 2 0 012-2h5m-1 11a4 4 0 01-4-4V7a4 4 0 014-4h5a4 4 0 014 4v1"
                />
              </svg>
              <div style={{
                position: 'absolute',
                top: '-0.25rem',
                right: '-0.25rem',
                height: '0.75rem',
                width: '0.75rem',
                backgroundColor: 'rgb(248 113 113)',
                borderRadius: '50%'
              }}></div>
            </Button>

            {/* 프로필 드롭다운 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              transition: 'background-color 200ms ease'
            }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}>
              <div style={{
                width: '2rem',
                height: '2rem',
                background: 'linear-gradient(to right, rgb(244 114 182), rgb(168 85 247))',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 'bold',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
              }}>
                K
              </div>
              <div style={{ display: 'none', textAlign: 'left' }}>
                <style>
                  {`
                    @media (min-width: 640px) {
                      .profile-info { display: block !important; }
                    }
                  `}
                </style>
                <div className="profile-info">
                <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>김사용자</p>
                <p style={{ fontSize: '0.75rem', color: 'rgb(191 219 254)' }}>관리자</p>
                </div>
              </div>
              <svg
                style={{ height: '1rem', width: '1rem', color: 'rgb(191 219 254)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}