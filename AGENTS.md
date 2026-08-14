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
- [ ] Phase 2: 교사 대시보드 통계 및 학급/학생별 세션·이벤트 뷰어 구현 (예정)

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
