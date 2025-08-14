import React from "react";
import { Card, CardContent } from "@vive/ui";
import type { TodoStats } from "@vive/types";
import styles from "./todo-stats.module.scss";

interface TodoStatsProps {
  stats: TodoStats;
  className?: string;
}

export function TodoStatsComponent({ stats, className = "" }: TodoStatsProps) {
  return (
    <div className={`${styles.statsGrid} ${className}`}>
      {/* 전체 할 일 */}
      <Card className={`${styles.statCard} ${styles.totalCard}`}>
        <CardContent className={styles.cardContent}>
          <div className={styles.cardInner}>
            <div>
              <p className={styles.statLabel}>전체 할 일</p>
              <p data-testid="stats-total" className={styles.statValue}>
                {stats.total}
              </p>
            </div>
            <div className={`${styles.iconWrapper} ${styles.totalIconWrapper}`}>
              <svg
                className={styles.icon}
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
      <Card className={`${styles.statCard} ${styles.activeCard}`}>
        <CardContent className={styles.cardContent}>
          <div className={styles.cardInner}>
            <div>
              <p className={`${styles.statLabel} ${styles.activeLabel}`}>
                진행 중
              </p>
              <p
                data-testid="stats-active"
                className={`${styles.statValue} ${styles.activeValue}`}>
                {stats.active}
              </p>
            </div>
            <div className={`${styles.iconWrapper} ${styles.activeIconWrapper}`}>
              <svg
                className={styles.icon}
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
      <Card className={`${styles.statCard} ${styles.completedCard}`}>
        <CardContent className={styles.cardContent}>
          <div className={styles.cardInner}>
            <div>
              <p className={`${styles.statLabel} ${styles.completedLabel}`}>완료됨</p>
              <p
                data-testid="stats-completed"
                className={`${styles.statValue} ${styles.completedValue}`}>
                {stats.completed}
              </p>
            </div>
            <div className={`${styles.iconWrapper} ${styles.completedIconWrapper}`}>
              <svg
                className={styles.icon}
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
      <Card className={`${styles.statCard} ${styles.rateCard}`}>
        <CardContent className={styles.cardContent}>
          <div className={styles.cardInner}>
            <div>
              <p className={`${styles.statLabel} ${styles.rateLabel}`}>완료율</p>
              <p
                data-testid="stats-completion-rate"
                className={`${styles.statValue} ${styles.rateValue}`}>
                {stats.completionRate}%
              </p>
            </div>
            <div className={`${styles.iconWrapper} ${styles.rateIconWrapper}`}>
              <svg
                className={styles.icon}
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
    <Card className={`${styles.progressBarCard} ${className}`}>
      <CardContent className={styles.cardContent}>
        <div className={styles.progressHeader}>
          <h3 className={styles.progressTitle}>
            전체 진행 상황
          </h3>
          <span className={styles.progressValue}>
            {stats.completionRate}%
          </span>
        </div>

        <div className={styles.progressContainer}>
          {/* 메인 프로그레스 바 */}
          <div className={styles.progressBarWrapper}>
            <div
              className={styles.progressBar}
              style={{
                width: `${stats.completionRate}%`
              }}
            />
            <div className={styles.progressBarOverlay}></div>
          </div>

          {/* 상세 진행률 표시 */}
          <div className={styles.progressDetails}>
            <span className={styles.progressDetailItem}>
              <div className={`${styles.progressDot} ${styles.activeDot}`}></div>
              진행중 {stats.active}개
            </span>
            <span className={styles.progressDetailItem}>
              <div className={`${styles.progressDot} ${styles.completedDot}`}></div>
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
    <Card className={`${styles.mobileStatsCard} ${className}`}>
      <CardContent className={styles.mobileStatsContent}>
        <div className={styles.mobileStatsGrid}>
          <div className={styles.mobileStatItem}>
            <div className={`${styles.mobileStatValue} ${styles.totalValue}`}>{stats.total}</div>
            <div className={styles.mobileStatLabel}>전체</div>
          </div>
          <div className={styles.mobileStatItem}>
            <div className={`${styles.mobileStatValue} ${styles.activeValue}`}>
              {stats.active}
            </div>
            <div className={styles.mobileStatLabel}>진행중</div>
          </div>
          <div className={styles.mobileStatItem}>
            <div className={`${styles.mobileStatValue} ${styles.completedValue}`}>
              {stats.completed}
            </div>
            <div className={styles.mobileStatLabel}>완료</div>
          </div>
          <div className={styles.mobileStatItem}>
            <div className={`${styles.mobileStatValue} ${styles.rateValue}`}>
              {stats.completionRate}%
            </div>
            <div className={styles.mobileStatLabel}>완료율</div>
          </div>
        </div>

        <div className={styles.mobileProgressBarContainer}>
          <div className={styles.mobileProgressBarWrapper}>
            <div
              className={styles.mobileProgressBar}
              style={{
                width: `${stats.completionRate}%`
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
