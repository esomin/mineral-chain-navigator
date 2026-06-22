# LOD (Level of Detail) 클러스터링 구현

## 개요

줌 레벨에 따라 공급망 그래프 노드를 집계/클러스터링하고, 무거운 레이아웃 연산을 Web Worker로 오프로드하여 메인 스레드 블로킹 없이 60fps 렌더링을 유지하는 기능을 구현했다.

---

## 핵심 개념

### LOD (Level of Detail)

3D 그래픽스에서 유래한 최적화 전략으로, **카메라와의 거리(줌 레벨)에 따라 표현의 상세 수준을 조절**하는 기법이다.

- **줌 아웃** (전체 보기): 국가별로 노드를 하나의 클러스터로 묶어 표시
- **줌 인** (상세 보기): 모든 노드를 개별적으로 표시

이를 통해 노드가 많을 때 시각적 혼잡도를 줄이고 렌더링 부하를 낮춘다.

| 줌 레벨 | 동작 | 클러스터 최소 노드 수 |
|---------|------|---------------------|
| ≤ 0.5 (CLUSTER_ZOOM) | 국가별 전면 클러스터링 | 2개 |
| 0.5 ~ 1.0 | 부분 클러스터링 | 3개 |
| ≥ 1.0 (DETAIL_ZOOM) | 클러스터링 없음, 모든 노드 개별 표시 | — |

### Web Worker

브라우저의 **별도 스레드**에서 JavaScript를 실행하는 API다. 메인 스레드(UI 렌더링)와 분리되어 동작하므로 무거운 계산이 화면 프레임을 떨어뜨리지 않는다.

```
┌─────────────────┐        postMessage         ┌──────────────────┐
│   메인 스레드    │  ─────────────────────────▶  │   Web Worker     │
│ (React/G6 렌더) │                              │ (클러스터링 계산) │
│                 │  ◀─────────────────────────  │                  │
└─────────────────┘        onmessage           └──────────────────┘
```

- 메인 스레드가 줌 이벤트 감지 → Worker에 클러스터링 요청 전송
- Worker가 연산 완료 → 결과를 메인 스레드로 반환
- 메인 스레드는 결과를 받아 그래프 데이터 갱신

---

## 구현 아키텍처

```
apps/frontend/src/
├── utils/
│   └── clustering.ts          ← 클러스터링 핵심 알고리즘 (순수 함수)
│   └── clustering.test.ts     ← 단위 테스트 (13개)
├── workers/
│   └── layout-worker.ts       ← Web Worker (클러스터링 + 레이아웃 연산)
├── hooks/
│   └── useLODClustering.ts    ← React 훅 (Worker 라이프사이클 관리)
├── components/
│   └── GraphRenderer.tsx      ← 수정: LOD 통합 및 줌 감지
└── store/
    └── supply-chain-store.ts  ← 수정: zoomLevel 상태 추가
```

---

## 변경 파일 상세

### 1. `src/utils/clustering.ts` (신규)

클러스터링 핵심 로직을 담은 순수 함수 모듈.

**주요 함수:**
- `computeLODClusters(nodes, zoomLevel)` — 줌 레벨에 따라 노드를 국가별로 그룹핑
- `toClusterableNodes(nodes, riskScores)` — SupplyChainNode를 Worker 전달용 직렬화 형식으로 변환

**핵심 불변식:**
```
clusters.totalMemberCount === 원본 노드 수
```
클러스터링 후에도 전체 노드 수가 보존되어야 한다 (Property 14 대응).

**클러스터 속성 계산:**
- 중심점(centroid): 멤버 노드 좌표의 산술 평균
- 총 생산량: 멤버 productionCapacity 합산
- 평균 리스크: 멤버 riskScore 평균

### 2. `src/workers/layout-worker.ts` (신규)

Web Worker 모듈. 두 가지 연산을 지원한다:

| 메시지 타입 | 역할 |
|------------|------|
| `compute-clusters` | LOD 클러스터링 계산 |
| `compute-layout` | Force-directed 레이아웃 좌표 계산 |

Vite의 `new Worker(new URL(...), { type: 'module' })` 패턴으로 빌드 시 별도 청크로 분리된다.

### 3. `src/hooks/useLODClustering.ts` (신규)

React 훅으로 Worker 라이프사이클을 관리한다.

**동작 흐름:**
1. 컴포넌트 마운트 시 Worker 인스턴스 생성
2. `zoomLevel` 변경 감지 → Worker에 클러스터링 요청
3. `requestId` 기반으로 최신 응답만 반영 (이전 요청 결과 폐기)
4. 컴포넌트 언마운트 시 Worker 종료

### 4. `src/components/GraphRenderer.tsx` (수정)

**추가된 기능:**
- `useLODClustering` 훅 통합
- 줌 레벨 감지 (`canvas:wheel`, `afterrender` 이벤트)
- 클러스터 노드 렌더링: 큰 원 + 점선 테두리 + 볼드 라벨
- 클러스터 간 엣지 병합 로직 (`buildClusteredEdges`)
- 클러스터 활성 상태 UI 인디케이터

**클러스터 노드 시각 차별점:**
| 속성 | 일반 노드 | 클러스터 노드 |
|------|----------|--------------|
| 크기 | capacity 비례 (30~100px) | 멤버 수 비례 (60~120px) |
| 테두리 | 실선 2px | 점선 3px |
| 라벨 | 10px normal | 12px bold |
| 색상 | 개별 리스크 | 평균 리스크 |

### 5. `src/store/supply-chain-store.ts` (수정)

- `zoomLevel: number` 상태 추가 (초기값 1.0)
- `setZoomLevel(zoomLevel)` 액션 추가

### 6. `tsconfig.json` (수정)

`lib`에 `"WebWorker"` 추가 — Worker 전용 타입(`DedicatedWorkerGlobalScope`, `self.onmessage` 등) 지원.

---

## 테스트 결과

```
✓ apps/frontend/src/utils/clustering.test.ts (13 tests)
  ✓ computeLODClusters
    ✓ 줌 레벨 >= DETAIL_ZOOM — 모든 노드 개별 표시
    ✓ 줌 레벨 <= CLUSTER_ZOOM — 국가별 클러스터링
    ✓ 전체 멤버 수 보존 불변식
    ✓ 중간 줌 레벨 — 부분 클러스터링
    ✓ 클러스터 중심점/리스크/생산량/라벨 계산
    ✓ 빈 입력 처리
  ✓ toClusterableNodes — 형식 변환 및 기본값 처리
```

전체 테스트: **256 passed** (기존 243 + 신규 13)

---

## 빌드 결과

```
dist/assets/layout-worker-uvHd5byH.js   2.41 kB   ← Worker 별도 청크
dist/assets/index-CyuWLW2u.js           1,596 kB   ← 메인 번들
```

Vite가 Worker 파일을 자동으로 별도 청크로 분리하여 메인 번들 크기에 영향을 주지 않는다.