import React, { useState } from "react";
import { Button, Input } from "@vive/ui";
import styles from "./todo-header.module.scss";

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
      className={styles.header}>
      <div className={styles.container}>
        <div className={styles.main}>
          {/* 왼쪽: 로고와 제목 */}
          <div className={styles.logoContainer}>
            <div className={styles.logoWrapper}>
              <div className={styles.logoIconWrapper}>
                <svg
                  className={styles.logoIcon}
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
                <h1 className={styles.title}>
                  TaskFlow
                </h1>
                <p className={styles.subtitle}>
                  생산성을 위한 스마트 할 일 관리
                </p>
              </div>
            </div>
          </div>

          {/* 가운데: 검색 */}
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <div className={styles.searchInputIcon}>
                <svg
                  className={styles.searchIcon}
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
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* 오른쪽: 액션 버튼들과 프로필 */}
          <div className={styles.actionsContainer}>
            {/* 테마 토글 */}
            <Button
              variant="ghost"
              size="sm"
              className={styles.actionButton}>
              <svg
                className={styles.actionIcon}
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
              className={`${styles.actionButton} ${styles.notificationButton}`}>
              <svg
                className={styles.actionIcon}
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
              <div className={styles.notificationDot}></div>
            </Button>

            {/* 프로필 드롭다운 */}
            <div className={styles.profileContainer}>
              <div className={styles.profileAvatar}>
                K
              </div>
              <div className={styles.profileInfo}>
                <p className={styles.profileName}>김사용자</p>
                <p className={styles.profileRole}>관리자</p>
              </div>
              <svg
                className={styles.profileDropdownIcon}
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
