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

## Force-Directed Layout 알고리즘

### 개요

Force-directed layout은 물리 시뮬레이션 기반 그래프 배치 알고리즘이다. 노드를 전하를 띤 입자, 엣지를 스프링으로 모델링하여 시스템이 에너지 최솟값에 도달할 때까지 반복 시뮬레이션을 수행한다.

본 프로젝트에서는 G6 v5의 `d3-force` 레이아웃을 사용한다.

### 핵심 힘(Force) 구성

```
┌───────────────────────────────────────────┐
│             Force 시뮬레이션               │
│                                           │
│  ① 척력 (nodeStrength: -400)             │
│     노드 간 서로 밀어내는 힘              │
│     → 겹침 방지, 적절한 간격 확보         │
│                                           │
│  ② 인력 (linkDistance: 150)              │
│     엣지로 연결된 노드를 끌어당기는 힘    │
│     → 연결된 노드끼리 가까이 배치         │
│                                           │
│  ③ 충돌 방지 (collide.strength: 0.8)     │
│     노드 반지름 기반 물리 충돌 감지       │
│     → 크기가 다른 노드도 겹치지 않음      │
└───────────────────────────────────────────┘
```

### 파라미터 설명

| 파라미터 | 값 | 역할 |
|---------|-----|------|
| `type` | `'d3-force'` | D3.js force simulation 기반 레이아웃 |
| `preventOverlap` | `true` | 노드 크기를 고려한 겹침 방지 |
| `linkDistance` | `150` | 엣지로 연결된 노드 간 목표 거리 (px) |
| `nodeStrength` | `-400` | 노드 간 척력 크기 (음수 = 밀어냄) |
| `collide.strength` | `0.8` | 충돌 해소 강도 (0~1, 1이면 완전 분리) |

### 시뮬레이션 흐름

```
1. 초기 배치 (무작위 또는 이전 위치)
       │
       ▼
2. 매 틱(tick)마다 힘 계산
   - 모든 노드 쌍에 척력 적용 (O(n²), Barnes-Hut 근사로 O(n log n))
   - 모든 엣지에 스프링력 적용
   - 충돌 감지 및 해소
       │
       ▼
3. 속도 감쇄 (alpha decay)
   - 각 틱마다 alpha 값이 감소 (기본: 0.0228씩 곱)
   - alpha < alphaMin (0.001) 이면 시뮬레이션 종료
       │
       ▼
4. 안정 상태 도달 → 렌더링 완료
```

### LOD 전환 시 위치 보존 전략

Force-layout의 특성상, 데이터를 교체하고 `render()`를 호출하면 시뮬레이션이 처음부터 재실행되어 노드 위치가 급변한다. 이를 방지하기 위해 LOD 전환 시 다음 전략을 적용한다:

1. **위치 캡처**: 전환 직전 모든 노드의 현재 (x, y) 좌표를 저장
2. **위치 할당**:
   - 기존에 존재하던 노드 → 이전 좌표 유지
   - 새로 생성된 클러스터 노드 → 멤버 노드들의 평균 좌표에 배치
   - 클러스터에서 펼쳐진 개별 노드 → 클러스터가 있던 위치 근처에 배치
3. **레이아웃 스킵**: `render()` 대신 `draw()`를 호출하여 force 시뮬레이션 없이 현재 좌표에서 바로 그림

```
[줌 아웃: 개별 → 클러스터]

  A(100,50)  B(120,60)  C(110,70)   →   Cluster_AB_C(110, 60)
       평균 좌표: (110, 60)

[줌 인: 클러스터 → 개별]

  Cluster(200,150)   →   A(200,150)  B(200,150)  C(200,150)
       클러스터 위치에서 시작 (이후 사용자가 드래그로 분리 가능)
```

### 성능 특성

| 노드 수 | 시뮬레이션 시간 (대략) | 적용 전략 |
|---------|----------------------|----------|
| ~14 (현재) | < 100ms | 즉시 렌더링, 최적화 불필요 |
| ~100 | 200~500ms | Web Worker로 오프로드 |
| ~1000+ | 1~3초 | Worker + Barnes-Hut 근사 + 서브샘플링 |

현재 14개 마스터 노드 규모에서는 force 시뮬레이션이 거의 즉시 수렴하므로 성능 이슈가 없다. Phase 2에서 노드가 증가하면 Worker 기반 레이아웃 계산이 의미를 갖게 된다.
