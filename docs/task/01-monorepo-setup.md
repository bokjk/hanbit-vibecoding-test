# 1단계: 모노레포 초기 설정

## 📋 작업 개요

pnpm workspace를 사용한 모노레포 구조 설정 및 기본 프로젝트 생성

## ✅ 완료 상태: **완료됨**

## 📝 세부 체크리스트

- [x] **1. 모노레포 초기 설정**
  - [x] `pnpm` 설치 및 `pnpm init`
  - [x] `pnpm-workspace.yaml` 파일 생성 및 `apps/*`, `packages/*` 설정
  - [x] `apps/client` 디렉터리에 Vite + React + TS 프로젝트 생성
  - [x] `apps/server` 디렉터리에 Node.js + TS 프로젝트 설정
  - [x] `packages/types` 디렉터리 생성 및 `tsconfig.json` 설정
  - [x] `packages/ui` 디렉터리 생성 및 `Shadcn/ui` 초기화
  - [x] **(커밋: `feat: setup pnpm monorepo with client, server, and packages`)**

## 🎯 달성한 목표

- pnpm workspace 기반 모노레포 구조 완성
- 프론트엔드(client), 백엔드(server), 공유 패키지(types, ui) 구조 설정
- 각 프로젝트별 TypeScript 설정 완료

## 📚 관련 문서

- [프로젝트 개요](../design/01-overview.md) - 전체 기술 스택 및 모노레포 구조
- [시스템 아키텍처](../design/02-architecture.md) - 모노레포 패키지 구조
