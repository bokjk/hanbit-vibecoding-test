import React from "react";
import { Card, CardContent } from "@vive/ui";
import type { TodoStats } from "@vive/types";

interface TodoStatsProps {
  stats: TodoStats;
  className?: string;
}

export function TodoStatsComponent({ stats, className = "" }: TodoStatsProps) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(2, 1fr)', 
      gap: '1rem'
    }}>
      {/* 전체 할 일 */}
      <Card style={{
        background: 'linear-gradient(to bottom right, rgb(239 246 255), rgb(219 234 254))',
        borderColor: 'rgb(191 219 254)',
        transition: 'all 200ms ease',
        cursor: 'pointer'
      }} onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      }} onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}>
        <CardContent style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'rgb(37 99 235)', marginBottom: '0.25rem' }}>
                전체 할 일
              </p>
              <p
                data-testid="stats-total"
                style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'rgb(29 78 216)' }}
              >
                {stats.total}
              </p>
            </div>
            <div style={{ width: '3rem', height: '3rem', backgroundColor: 'rgb(59 130 246)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 진행 중 */}
      <Card style={{
        background: 'linear-gradient(to bottom right, rgb(255 247 237), rgb(254 215 170))',
        borderColor: 'rgb(253 186 116)',
        transition: 'all 200ms ease',
        cursor: 'pointer'
      }} onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      }} onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}>
        <CardContent style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'rgb(234 88 12)', marginBottom: '0.25rem' }}>
                진행 중
              </p>
              <p
                data-testid="stats-active"
                style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'rgb(194 65 12)' }}
              >
                {stats.active}
              </p>
            </div>
            <div style={{ width: '3rem', height: '3rem', backgroundColor: 'rgb(249 115 22)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 완료됨 */}
      <Card style={{
        background: 'linear-gradient(to bottom right, rgb(240 253 244), rgb(187 247 208))',
        borderColor: 'rgb(134 239 172)',
        transition: 'all 200ms ease',
        cursor: 'pointer'
      }} onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      }} onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}>
        <CardContent style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'rgb(22 163 74)', marginBottom: '0.25rem' }}>완료됨</p>
              <p
                data-testid="stats-completed"
                style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'rgb(21 128 61)' }}
              >
                {stats.completed}
              </p>
            </div>
            <div style={{ width: '3rem', height: '3rem', backgroundColor: 'rgb(34 197 94)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 완료율 */}
      <Card style={{
        background: 'linear-gradient(to bottom right, rgb(250 245 255), rgb(221 214 254))',
        borderColor: 'rgb(196 181 253)',
        transition: 'all 200ms ease',
        cursor: 'pointer'
      }} onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
      }} onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}>
        <CardContent style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'rgb(147 51 234)', marginBottom: '0.25rem' }}>완료율</p>
              <p
                data-testid="stats-completion-rate"
                style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'rgb(126 34 206)' }}
              >
                {stats.completionRate}%
              </p>
            </div>
            <div style={{ width: '3rem', height: '3rem', backgroundColor: 'rgb(168 85 247)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* 프로그레스 바 컴포넌트 */
export function TodoProgressBar({ stats, className = "" }: TodoStatsProps) {
  return (
    <Card style={{ 
      background: 'linear-gradient(to right, rgb(249 250 251), rgb(243 244 246))',
      // className prop removed
    }}>
      <CardContent style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'rgb(31 41 55)' }}>
            전체 진행 상황
          </h3>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'rgb(55 65 81)' }}>
            {stats.completionRate}%
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* 메인 프로그레스 바 */}
          <div style={{ position: 'relative', width: '100%', height: '1.5rem', backgroundColor: 'rgb(229 231 235)', borderRadius: '9999px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }}>
            <div
              style={{ 
                height: '100%', 
                background: 'linear-gradient(to right, rgb(59 130 246), rgb(168 85 247), rgb(34 197 94))', 
                borderRadius: '9999px', 
                transition: 'all 1000ms ease-out', 
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                width: `${stats.completionRate}%`
              }}
            />
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent)', borderRadius: '9999px' }}></div>
          </div>

          {/* 상세 진행률 표시 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'rgb(75 85 99)' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '0.75rem', height: '0.75rem', backgroundColor: 'rgb(251 146 60)', borderRadius: '50%', marginRight: '0.5rem' }}></div>
              진행중 {stats.active}개
            </span>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '0.75rem', height: '0.75rem', backgroundColor: 'rgb(74 222 128)', borderRadius: '50%', marginRight: '0.5rem' }}></div>
              완료 {stats.completed}개
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* 모바일용 간단한 통계 */
export function TodoStatsCard({ stats, className = "" }: TodoStatsProps) {
  return (
    <Card style={{ display: 'none' }}>
      <style>
        {`
          @media (min-width: 768px) {
            .mobile-stats { display: none !important; }
          }
        `}
      </style>
      <div className="mobile-stats">
      <CardContent style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'rgb(37 99 235)' }}>{stats.total}</div>
            <div style={{ color: 'rgb(75 85 99)' }}>전체</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'rgb(234 88 12)' }}>
              {stats.active}
            </div>
            <div style={{ color: 'rgb(75 85 99)' }}>진행중</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'rgb(22 163 74)' }}>
              {stats.completed}
            </div>
            <div style={{ color: 'rgb(75 85 99)' }}>완료</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'rgb(147 51 234)' }}>
              {stats.completionRate}%
            </div>
            <div style={{ color: 'rgb(75 85 99)' }}>완료율</div>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ width: '100%', backgroundColor: 'rgb(229 231 235)', borderRadius: '9999px', height: '0.5rem' }}>
            <div
              style={{ 
                background: 'linear-gradient(to right, rgb(59 130 246), rgb(34 197 94))', 
                height: '0.5rem', 
                borderRadius: '9999px', 
                transition: 'all 500ms ease',
                width: `${stats.completionRate}%`
              }}
            />
          </div>
        </div>
      </CardContent>
      </div>
    </Card>
  );
}