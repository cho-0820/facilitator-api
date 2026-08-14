# AGENTS.md

## 프로젝트 개요
- **목표**: AI 퍼실리테이터 교사 대시보드 및 백엔드 API 시스템 (`facilitator-api`)
- **기반 플랫폼**: Next.js 16 (App Router), React 19, TypeScript, Supabase, Vercel

## 검증 보고 신뢰 원칙

> **이 섹션은 신뢰성 있는 검증을 위한 의무 규칙이다.**

### 의무 원칙
1. **"검증 완료/확인됨/재현됨"이라고 할 때는** 실제 조작 방식(자동화 vs 수동)과 **원본 로그/터미널 출력/스크린샷을 그대로 제시**할 것. 요약·설명으로 대체 금지. 시뮬레이션·예상 시나리오라면 먼저 그렇다고 밝힐 것.
2. 검증하려는 **UI 기능·상태가 실제로 존재하는지 먼저 확인**한 후 테스트를 설계할 것. 존재하지 않으면 테스트 진행 전에 먼저 보고할 것.
3. 사용자가 직접 확인을 요청하면 **즉시 실제 앱 구동·실제 파일 읽기로 수행**하고 가짜 Mock으로 대체하지 말 것. 부득이하게 Puppeteer/CDP 등 자동화를 쓴다면 그 사실과 스크립트 내용을 투명하게 공개할 것.

## 현재 단계
- [x] Phase 1: PIN 기반 교사 대시보드 진입점 보호 (`/teacher`, `/teacher/login`, `middleware.ts`, Web Crypto HMAC-SHA256 토큰 쿠키 인증) (완료)
- [x] Phase 2: 교사 대시보드 통계 API 및 UI 구현 (`GET /api/teacher/classrooms`, `GET /api/teacher/classrooms/[id]/summary`, `app/teacher/page.tsx`) (완료)

## Phase 2 구현 결정사항
1. **아동 개인정보 보호 (Consent Redaction)**:
   - `consent_status === false`인 학생은 세션/이벤트 조회를 아예 건너뛰고 `{ id, student_code, nickname, consent_status: false, status_label: '비공개(미동의)', phase_counts: null, trigger_counts: null, repeated_errors: null, total_events: 0 }` 형태로 마스킹하여 반환.
   - UI에서도 미동의 학생 행은 회색(`bg-gray-100`) 배경 및 "비공개(미동의)"로 처리하여 통계 데이터 노출을 완벽 차단.
2. **트리거 전략 6종 및 국면(Phase) 매핑**:
   - `trigger_strategy`: `modeling`, `scaffolding`, `coaching`, `clarification`, `reflection`, `exploration` (6종 원문 철자 유지, articulation 아님).
   - 국면 매핑: `planning` (`modeling` + `scaffolding`), `monitoring` (`coaching` + `clarification`), `modification` (`reflection` + `exploration`).
3. **반복 오류 집계**:
   - `event_type === 'error'` 이벤트의 `payload.message` 기준 `count >= 2`인 오류만 내림차순 정렬하여 `repeated_errors` 배열로 제공.
4. **UI 대시보드 구성**:
   - `app/teacher/page.tsx`: 학급 선택 드롭다운, 학생별 통계 테이블 (학생 정보, 연구 동의 배지, 국면별 개입 뱃지, 전략별 개입 건수, 2회 이상 반복 오류 목록).

## Phase 1 구현 결정사항
1. **PIN 환경변수 관리**:
   - `TEACHER_DASHBOARD_PIN` 환경변수로 PIN 번호 관리 (코드에 평문 하드코딩 금지, `.env.example`에 템플릿 제공)
2. **토큰 서명 및 인증**:
   - `lib/teacher-auth.ts`: Web Crypto API (`crypto.subtle`) 기반 HMAC-SHA256 토큰 생성 및 검증 (Edge/Node 런타임 호환)
   - 쿠키 설정: `teacher_session`, `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'strict'`, `path: '/'`, `maxAge: 86400`
3. **라우트 보호**:
   - `middleware.ts`: `/teacher/**` 및 `/api/teacher/**` 경로 가로채기
   - `/teacher/login`, `/api/teacher/auth`는 예외 바이패스
   - 미인증 시 페이지 요청은 `/teacher/login`으로 307 리다이렉트, API 요청은 401 JSON 응답
4. **UI 페이지**:
   - `/teacher/login`: 최소 PIN 입력 폼 (키보드 이벤트 및 fetch 통신)
   - `/teacher`: 인증된 교사 전용 자리표시자 페이지

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
