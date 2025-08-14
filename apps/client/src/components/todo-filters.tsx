import React from "react";
import { Button } from "@vive/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vive/ui";
import type { TodoFilter, FilterType, SortBy, SortOrder } from "@vive/types";
import type {
  FilterHelpers,
  SyncHelpers,
  TodoMetadata,
} from "../hooks/use-todo";

interface TodoFiltersProps {
  filter: FilterHelpers | TodoFilter;
  onFilterChange: FilterHelpers | ((filter: TodoFilter) => void);
  syncHelpers?: SyncHelpers;
  metadata?: TodoMetadata;
  className?: string;
}

interface FilterChipProps {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

function FilterChip({
  label,
  icon,
  isActive,
  onClick,
  count,
}: FilterChipProps) {
  const testId = `filter-${label === "전체" ? "all" : label === "진행 중" ? "active" : label === "완료됨" ? "completed" : label.toLowerCase()}`;

  return (
    <Button
      data-testid={testId}
      variant={isActive ? "default" : "outline"}
      onClick={onClick}
      style={{
        height: '2.5rem',
        padding: '0 1rem',
        transition: 'all 200ms ease',
        background: isActive 
          ? 'linear-gradient(to right, rgb(59 130 246), rgb(147 51 234))' 
          : 'white',
        color: isActive ? 'white' : 'rgb(17 24 39)',
        border: isActive ? 'none' : '1px solid rgb(229 231 235)',
        boxShadow: isActive ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon && <span style={{ width: '1rem', height: '1rem' }}>{icon}</span>}
        <span style={{ fontWeight: '500' }}>{label}</span>
        {count !== undefined && (
          <span style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '9999px',
            backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgb(243 244 246)'
          }}>
            {count}
          </span>
        )}
      </div>
    </Button>
  );
}

export function TodoFilters({
  filter,
  onFilterChange,
  syncHelpers,
  metadata,
  className = "",
}: TodoFiltersProps) {
  const isLegacyFilter = typeof onFilterChange === "function";

  const handleFilterTypeChange = (type: FilterType) => {
    if (isLegacyFilter && typeof filter === "object" && "type" in filter) {
      (onFilterChange as (filter: TodoFilter) => void)({ ...filter, type });
    } else if (typeof filter === "object" && "showAll" in filter) {
      const filterHelpers = filter as FilterHelpers;
      switch (type) {
        case "all":
          filterHelpers.showAll();
          break;
        case "active":
          filterHelpers.showActive();
          break;
        case "completed":
          filterHelpers.showCompleted();
          break;
      }
    }
  };

  const handleSortByChange = (sortBy: SortBy) => {
    if (isLegacyFilter && typeof filter === "object" && "sortBy" in filter) {
      (onFilterChange as (filter: TodoFilter) => void)({ ...filter, sortBy });
    } else if (typeof filter === "object" && "sortByCreatedAt" in filter) {
      const filterHelpers = filter as FilterHelpers;
      switch (sortBy) {
        case "createdAt":
          filterHelpers.sortByCreatedAt();
          break;
        case "priority":
          filterHelpers.sortByPriority();
          break;
        case "title":
          filterHelpers.sortByTitle();
          break;
      }
    }
  };

  const handleSortOrderChange = (sortOrder: SortOrder) => {
    if (isLegacyFilter && typeof filter === "object" && "sortOrder" in filter) {
      (onFilterChange as (filter: TodoFilter) => void)({
        ...filter,
        sortOrder,
      });
    } else if (typeof filter === "object" && "sortByCreatedAt" in filter) {
      const filterHelpers = filter as FilterHelpers;
      // 정렬 순서는 메서드 파라미터로 전달
      filterHelpers.sortByCreatedAt(sortOrder);
    }
  };

  // 현재 필터 상태 추출 (레거시 호환성)
  const currentFilter = isLegacyFilter
    ? (filter as TodoFilter)
    : {
        type: "all" as FilterType,
        sortBy: "createdAt" as SortBy,
        sortOrder: "desc" as SortOrder,
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 스마트 필터 칩들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'rgb(55 65 81)', display: 'flex', alignItems: 'center' }}>
          <svg
            style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
            />
          </svg>
          필터
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <FilterChip
            label="전체"
            icon={
              <svg
                style={{ width: '1rem', height: '1rem' }}
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
            }
            isActive={currentFilter.type === "all"}
            onClick={() => handleFilterTypeChange("all")}
          />

          <FilterChip
            label="진행 중"
            icon={
              <svg
                style={{ width: '1rem', height: '1rem' }}
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
            }
            isActive={currentFilter.type === "active"}
            onClick={() => handleFilterTypeChange("active")}
          />

          <FilterChip
            label="완료됨"
            icon={
              <svg
                style={{ width: '1rem', height: '1rem' }}
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
            }
            isActive={currentFilter.type === "completed"}
            onClick={() => handleFilterTypeChange("completed")}
          />
        </div>
      </div>

      {/* 우선순위 필터 (새로운 기능) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'rgb(55 65 81)', display: 'flex', alignItems: 'center' }}>
          <svg
            style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          우선순위
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <FilterChip
            label="긴급"
            icon={<div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: 'rgb(239 68 68)' }}></div>}
            isActive={false}
            onClick={() => {}}
          />

          <FilterChip
            label="보통"
            icon={<div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: 'rgb(245 158 11)' }}></div>}
            isActive={false}
            onClick={() => {}}
          />

          <FilterChip
            label="낮음"
            icon={<div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: 'rgb(34 197 94)' }}></div>}
            isActive={false}
            onClick={() => {}}
          />
        </div>
      </div>

      {/* 정렬 옵션 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'rgb(55 65 81)', display: 'flex', alignItems: 'center' }}>
          <svg
            style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
          정렬
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
          <Select
            value={currentFilter.sortBy}
            onValueChange={handleSortByChange}
          >
            <SelectTrigger
              data-testid="sort-by-select"
              style={{
                height: '2.5rem',
                backgroundColor: 'white',
                border: '1px solid rgb(229 231 235)',
                transition: 'border-color 200ms ease'
              }}
            >
              <SelectValue placeholder="정렬 기준" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg
                    style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
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
                  생성일순
                </span>
              </SelectItem>
              <SelectItem value="priority" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg
                    style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  우선순위순
                </span>
              </SelectItem>
              <SelectItem value="title" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg
                    style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  제목순
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={currentFilter.sortOrder}
            onValueChange={handleSortOrderChange}
          >
            <SelectTrigger
              data-testid="sort-order-select"
              style={{
                height: '2.5rem',
                backgroundColor: 'white',
                border: '1px solid rgb(229 231 235)',
                transition: 'border-color 200ms ease'
              }}
            >
              <SelectValue placeholder="정렬 순서" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg
                    style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  내림차순
                </span>
              </SelectItem>
              <SelectItem value="asc" style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg
                    style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                  오름차순
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 동기화 상태 섹션 */}
      {syncHelpers && metadata && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgb(229 231 235)' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'rgb(55 65 81)', display: 'flex', alignItems: 'center' }}>
            <svg
              style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            동기화 상태
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* 연결 상태 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'rgb(75 85 99)' }}>연결 상태:</span>
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: metadata.isOnline ? 'rgb(220 252 231)' : 'rgb(254 226 226)',
                color: metadata.isOnline ? 'rgb(21 128 61)' : 'rgb(185 28 28)'
              }}>
                {syncHelpers.getConnectionStatusText()}
              </span>
            </div>

            {/* 동기화 상태 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'rgb(75 85 99)' }}>동기화:</span>
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: metadata.isSyncing ? 'rgb(219 234 254)' : metadata.hasErrors ? 'rgb(254 226 226)' : 'rgb(243 244 246)',
                color: metadata.isSyncing ? 'rgb(29 78 216)' : metadata.hasErrors ? 'rgb(185 28 28)' : 'rgb(55 65 81)'
              }}>
                {syncHelpers.getSyncStatusText()}
              </span>
            </div>

            {/* 대기 중인 작업 */}
            {metadata.pendingOperations > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'rgb(75 85 99)' }}>대기 중:</span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgb(254 240 138)',
                  color: 'rgb(180 83 9)'
                }}>
                  {metadata.pendingOperations}개 작업
                </span>
              </div>
            )}

            {/* 마지막 동기화 시간 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'rgb(75 85 99)' }}>마지막 동기화:</span>
              <span style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: 'rgb(243 244 246)',
                color: 'rgb(55 65 81)'
              }}>
                {syncHelpers.getLastSyncText()}
              </span>
            </div>
          </div>

          {/* 동기화 액션 버튼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Button
              size="sm"
              variant="outline"
              onClick={syncHelpers.triggerSync}
              disabled={metadata.isSyncing}
              style={{
                width: '100%',
                height: '2rem',
                fontSize: '0.75rem',
                border: '1px solid rgb(229 231 235)',
                backgroundColor: 'white',
                borderRadius: '0.375rem',
                cursor: metadata.isSyncing ? 'not-allowed' : 'pointer',
                transition: 'all 200ms ease',
                opacity: metadata.isSyncing ? 0.5 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {metadata.isSyncing ? (
                  <>
                    <svg
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        marginRight: '0.5rem',
                        animation: 'spin 1s linear infinite'
                      }}
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        style={{ opacity: 0.25 }}
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        style={{ opacity: 0.75 }}
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    동기화 중...
                  </>
                ) : (
                  <>
                    <svg
                      style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.5rem' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    수동 동기화
                  </>
                )}
              </div>
            </Button>

            {/* 오프라인 모드 토글 */}
            <Button
              size="sm"
              variant={metadata.isOnline ? "outline" : "default"}
              onClick={syncHelpers.toggleOfflineMode}
              style={{
                width: '100%',
                height: '2rem',
                fontSize: '0.75rem',
                border: '1px solid rgb(229 231 235)',
                backgroundColor: metadata.isOnline ? 'white' : 'rgb(17 24 39)',
                color: metadata.isOnline ? 'rgb(17 24 39)' : 'white',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {metadata.isOnline ? (
                  <>
                    <svg
                      style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.5rem' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12c0 4.971-4.029 9-9 9s-9-4.029-9-9 4.029-9 9-9 9 4.029 9 9z"
                      />
                    </svg>
                    오프라인 모드
                  </>
                ) : (
                  <>
                    <svg
                      style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.5rem' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                      />
                    </svg>
                    온라인 모드
                  </>
                )}
              </div>
            </Button>

            {/* 에러 정리 버튼 (에러가 있을 때만 표시) */}
            {metadata.hasErrors && (
              <Button
                size="sm"
                variant="destructive"
                onClick={syncHelpers.clearErrors}
                style={{
                  width: '100%',
                  height: '2rem',
                  fontSize: '0.75rem',
                  border: '1px solid rgb(239 68 68)',
                  backgroundColor: 'rgb(239 68 68)',
                  color: 'white',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 200ms ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg
                    style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.5rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  에러 정리
                </div>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
