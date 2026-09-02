# Lithium Supply Chain Navigator

## Overview

2025년 기준 리튬(HS 2825.20: 산화리튬 및 수산화리튬) 공급망의 물리적 경로를 추적하고 리스크를 분석하는 학습/시각화 웹 애플리케이션.

5개국(한국, 일본, 중국, 칠레, 미국)의 14개 마스터 노드를 대상으로 광산→제련소→공장 공급망 구조를 그래프로 시각화하고, HHI(공급 집중도) + WGI(지정학적 안정성) 기반 리스크를 정량 분석한다.

## Key Features & Implementation Status

| Phase | 기능 | 설명 |
|-------|------|------|
| **Phase 1 (MVP)** | 공급망 그래프 모델링 | 14개 노드(Resource/Mine/Refinery/Factory), Supply/Delivery 엣지 (현재 27개 노드로 확장) |
| | 시드 데이터 파이프라인 | USGS, UN Comtrade, KOMIS 기반 2025년 데이터 로딩 |
| | 리스크 분석 엔진 | HHI + WGI 2팩터 통합, 0-100 정규화, 고위험 플래깅 |
| | Force-directed 그래프 시각화 | WebGL 캔버스, 노드 크기 비례 렌더링, 리스크 색상 코딩 |
| | 필터 & 디테일 패널 | 국가/타입/리스크 필터, 노드 클릭 상세 정보 |
| **Phase 2 (Interactive & Decision)** | 충격 시뮬레이션 | 수출 규제/시설 폐쇄 시나리오 전파 분석 |
| | 대체 공급망 자동 추천 & 경로 재설정 | 마비 노드 발생 시 최적 우회 경로 탐색 및 리스크/비용 재계산 (Global/Individual Re-routing) |
| | AI 인사이트 패널 | LLM 기반 자연어 질의 및 대체 공급망 추천 리포트 생성 (OpenAI / Gemini 연동 및 Fallback) |
| | 벡터 임베딩 & RAG 검색 | 정책/기술 문서 인덱싱, 청킹 및 유사도 검색 기반 AI 답변 강화 (인메모리 InMemoryVectorStore 구현) |
| | 영속 DB 마이그레이션 | PostgreSQL + pgvector 실제 DB 인프라 구축 및 영속 저장소 전환 (미구현 - 현재 InMemoryStore 동작, PgStore 인터페이스만 정의) |
| **Phase 3 (Spatial & Traceability)** | GIS 지도 시각화 | Deck.gl + MapLibre GL 세계 지도 위 물류 경로 시각화 및 지능형 맵 오버레이 |
| | ESG 역추적 | Factory→Mine 업스트림 경로 투명성 검증 및 탄소/윤리 리스크 추적 |
| | 실시간 데이터 자동 동기화 | 관세청/UN Comtrade 주기적 크롤링 및 실시간 공급망 변동 자동 파이프라인 (미구현 - 현재 스크립트 수동 실행 방식) |

## Architecture

### 5-Layer System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Presentation Layer                                      │
│  React 18 + WebGL Graph / Deck.gl Map                    │
├─────────────────────────────────────────────────────────┤
│  State Management Layer                                  │
│  Zustand (필터, 선택, 뷰 상태 보존)                        │
├─────────────────────────────────────────────────────────┤
│  Application Layer (REST API)                            │
│  Node.js + Express + TypeScript                          │
│  Graph API / Risk API / Simulation API / Insight API     │
├─────────────────────────────────────────────────────────┤
│  Business Logic Layer                                    │
│  Risk Engine (HHI+WGI) / Rerouting Engine / Vector DB    │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  JSON 인메모리 (Phase 1) → PostgreSQL + pgvector (Phase 2+)│
│  시드 데이터: USGS, UN Comtrade, KOMIS, World Bank WGI    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| 영역 | Phase 1 (MVP) | Phase 2 | Phase 3 |
|------|--------------|---------|---------|
| Frontend | React 18 + TypeScript | 동일 | 동일 |
| Graph Rendering | @antv/G6 또는 Sigma.js (WebGL) | 동일 | 동일 |
| Map Rendering | — | — | Deck.gl + Mapbox GL |
| Backend | Node.js + Express + TypeScript | 동일 | 동일 |
| Data Store | JSON 파일 기반 인메모리 | PostgreSQL + pgvector | 동일 |
| LLM | — | OpenAI GPT-4 API | 동일 |
| State Management | Zustand | 동일 | 동일 |
| Testing | Vitest + fast-check (PBT) | 동일 | 동일 |
| Linting | ESLint + Prettier | 동일 | 동일 |

## Project Structure (Monorepo)

```
mineral-chain-navigator/
├── apps/                          # 실행 가능 애플리케이션
│   ├── backend/                   # @navigator/backend — Express API 서버
│   │   └── src/
│   │       ├── controllers/       # RiskController, GraphController
│   │       ├── routes/            # API 라우팅 정의
│   │       ├── ingestion/         # 시드 데이터 로딩 진입점
│   │       ├── server.ts          # Express 엔트리포인트
│   │       └── store.ts           # 저장소 인스턴스 생성
│   └── frontend/                  # @navigator/frontend — React SPA
│       └── src/
│
├── packages/                      # 내부 라이브러리 (비즈니스 로직)
│   ├── shared/                    # @navigator/shared — 공통 타입·검증·유틸
│   │   └── src/
│   │       ├── types/             # SupplyChainNode, Edge, RiskScore 등
│   │       ├── validators/        # 그래프 데이터 검증기
│   │       ├── serialization/     # 직렬화/역직렬화 헬퍼
│   │       └── utils/             # normalizeScore, clamp
│   ├── core/                      # @navigator/core — 순수 비즈니스 로직 (I/O 없음)
│   │   └── src/
│   │       └── risk/              # HHI·WGI 리스크 계산 엔진
│   ├── database/                  # @navigator/database — 데이터 저장소 추상화
│   │   └── src/
│   │       ├── memory/            # InMemoryStore (Phase 1)
│   │       ├── seed/              # 시드 데이터 로더
│   │       └── pg/                # PostgreSQL 클라이언트 (Phase 2 예약)
│   └── pipeline/                  # @navigator/pipeline — 데이터 수집·가공
│       ├── src/                   # COMTRADE fetch, 정규화, 파싱 스크립트
│       └── data/                  # 원천 JSON 파일 (USGS, Comtrade 등)
│
├── package.json                   # 루트 워크스페이스 설정
├── tsconfig.json                  # TypeScript project references (루트)
├── vitest.config.ts               # 전체 테스트 설정
├── .eslintrc.cjs                  # ESLint 설정
└── .prettierrc                    # Prettier 설정
```

### 패키지 의존성 방향

```
shared (의존 없음)
  ↑
core, database (→ shared)
  ↑
pipeline (→ shared, database)
  ↑
apps/backend (→ core, database, shared)
apps/frontend (→ shared)
```

## Getting Started

### Prerequisites

- **Node.js** v18 이상
- **npm** v9 이상 (workspaces 지원 필요)

### Installation & Run

```bash
# 1. 저장소 클론
git clone <repository-url>
cd mineral-chain-navigator

# 2. 전체 의존성 설치 (워크스페이스 링크 자동 생성)
npm install

# 3. 전체 빌드
npm run build

# 4. 테스트 실행
npm test

# 5. 백엔드 서버 실행
npm start -w apps/backend

# 6. (선택) 데이터 파이프라인 실행 — COMTRADE 데이터 수집
npm run fetch:comtrade

# 7. (선택) 리튬 생산 데이터 수집
npm run fetch:production
```

#### 개별 패키지 작업

```bash
# 특정 패키지 테스트
npm test -w packages/core
npm test -w packages/database

# 특정 패키지 빌드
npm run build -w packages/shared

# 린트
npm run lint
```