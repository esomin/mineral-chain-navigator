# 공급망 그래프 데이터 유효성 검증 가이드

## 1. 유효성 검증의 필요성

Mineral Chain Navigator는 핵심 광물 공급망의 물리적 경로를 그래프로 모델링한다. 그래프 데이터의 정확성은 리스크 분석, 시뮬레이션, 시각화 등 모든 하위 기능의 신뢰성에 직결된다.

유효성 검증이 필요한 이유:

- **데이터 무결성 보장**: 잘못된 타입이나 누락된 필드가 그래프에 유입되면 리스크 엔진의 계산 결과가 왜곡된다.
- **참조 무결성 유지**: 존재하지 않는 노드를 참조하는 엣지가 생성되면 그래프 순회와 시뮬레이션이 실패한다.
- **조기 오류 탐지**: API 경계에서 입력을 검증하여, 잘못된 데이터가 DB에 저장되기 전에 차단한다.
- **오류 격리**: 무효한 데이터가 거부되더라도 기존 그래프 상태는 영향받지 않아야 한다 (Property 8).

## 2. 검증 대상 및 절차

### 2.1 노드/엣지 타입 검증

| 항목 | 유효한 값 |
|------|-----------|
| NodeType | `Resource`, `Mine`, `Refinery`, `Gigafactory`, `Country`, `Policy` |
| EdgeType | `Supply`, `Delivery`, `Export_Restriction`, `Ownership` |

**함수**: `validateNodeType(type: string): boolean`, `validateEdgeType(type: string): boolean`

**절차**:
1. 입력 문자열을 유효한 타입 집합(Set)과 대조한다.
2. 집합에 포함되면 `true`, 아니면 `false`를 반환한다.
3. 대소문자를 구분한다 (`resource` ≠ `Resource`).

### 2.2 노드 생성 입력 검증

**함수**: `validateNodeInput(input: CreateNodeInput): ValidationResult`

**검증 항목**:

| 필드 | 조건 |
|------|------|
| `id` | 비어있지 않은 문자열 |
| `type` | 유효한 NodeType |
| `name` | 비어있지 않은 문자열 |
| `coordinates.latitude` | 숫자, -90 ≤ lat ≤ 90 |
| `coordinates.longitude` | 숫자, -180 ≤ lng ≤ 180 |

**절차**:
1. 각 필수 필드의 존재 여부와 타입을 확인한다.
2. `type` 필드는 `validateNodeType`으로 재검증한다.
3. 좌표값이 허용 범위를 초과하는지 확인한다.
4. 모든 오류를 수집하여 `ValidationResult`로 반환한다.

### 2.3 엣지 생성 입력 검증

**함수**: `validateEdgeInput(input: CreateEdgeInput, existingNodeIds: Set<string>): ValidationResult`

**검증 항목**:

| 필드 | 조건 |
|------|------|
| `id` | 비어있지 않은 문자열 |
| `type` | 유효한 EdgeType |
| `sourceNodeId` | 비어있지 않은 문자열 + 존재하는 노드 |
| `targetNodeId` | 비어있지 않은 문자열 + 존재하는 노드 |

**절차**:
1. 기본 필드 검증 (id, type)을 수행한다.
2. `type`은 `validateEdgeType`으로 재검증한다.
3. `sourceNodeId`와 `targetNodeId`가 `existingNodeIds` 집합에 존재하는지 확인한다 (참조 무결성).
4. 모든 오류를 수집하여 `ValidationResult`로 반환한다.

## 3. 반환 형식

```typescript
interface ValidationResult {
    valid: boolean;   // 검증 통과 여부
    errors: string[]; // 실패 사유 목록 (valid=true일 때 빈 배열)
}
```

검증 실패 시 `errors` 배열에 어떤 필드가 왜 거부되었는지 사람이 읽을 수 있는 메시지가 포함된다. 이를 통해 API 응답에서 구체적인 400 Bad Request 메시지를 생성할 수 있다.

## 4. JSON 직렬화/역직렬화

그래프 데이터의 영속화와 API 전송을 위해 JSON 변환 함수를 제공한다.

| 함수 | 변환 방향 |
|------|-----------|
| `serializeNode` | `SupplyChainNode` → `SerializedNode` (snake_case, ISO 8601) |
| `deserializeNode` | `SerializedNode` → `SupplyChainNode` (camelCase, Date) |
| `serializeEdge` | `SupplyChainEdge` → `SerializedEdge` |
| `deserializeEdge` | `SerializedEdge` → `SupplyChainEdge` |

**변환 규칙**:
- `createdAt` / `updatedAt` (Date) ↔ `created_at` / `updated_at` (ISO 8601 string)
- `sourceNodeId` / `targetNodeId` ↔ `source_node_id` / `target_node_id`
- `coordinates.latitude` / `coordinates.longitude` ↔ `coordinates.lat` / `coordinates.lng`

라운드트립 속성(Property 4)에 의해, 직렬화 후 역직렬화하면 원본과 동등한 객체가 보장된다.

## 5. 테스트 전략

- **단위 테스트**: 유효한 입력 수락, 각 필드별 거부 사유, 경계값 확인
- **속성 기반 테스트** (optional, fast-check): 임의 입력에 대해 검증 규칙이 일관되게 적용되는지 100회+ 반복 확인
- 테스트 파일 위치: `packages/shared/src/validators/graph-validators.test.ts`, `packages/shared/src/serialization/graph-serialization.test.ts`

## 6. 파일 구조

```
packages/shared/src/
├── types/
│   ├── graph.ts              # SupplyChainNode, Edge, CreateNodeInput, ValidationResult 등
│   └── serialization.ts      # SerializedNode, SerializedEdge
├── validators/
│   ├── graph-validators.ts   # validateNodeType, validateNodeInput, validateEdgeInput
│   └── graph-validators.test.ts
└── serialization/
    ├── graph-serialization.ts      # serializeNode, deserializeNode 등
    └── graph-serialization.test.ts
```

---

## 7. LOD 클러스터링 전환 시 그래프 데이터 업데이트 로직

### 개요

줌 레벨이 임계값(`CLUSTER_ZOOM: 0.8`)을 넘나들 때 그래프 데이터가 교체된다. 전환 방향에 따라 다른 렌더링 전략을 적용하여 시각적 안정성을 보장한다.

### 전환 방향별 전략

| 전환 방향 | 조건 | 렌더 방식 | 이유 |
|-----------|------|-----------|------|
| 개별 → 클러스터 | 줌 아웃 (> 0.8 → ≤ 0.8) | `draw()` (위치 보존) | 기존 노드 위치를 기반으로 클러스터 중심 계산 가능 |
| 클러스터 → 개별 | 줌 인 (≤ 0.8 → > 0.8) | `render()` (force-layout 재실행) | 클러스터 해제 시 모든 멤버가 동일 좌표에 겹치므로 재배치 필요 |

### 상세 흐름

```
줌 변경 감지 (canvas:wheel)
    │
    ▼
zoomLevel 상태 업데이트
    │
    ▼
useLODClustering 훅: isClustered 재계산
    │
    ▼
LOD useEffect 트리거
    │
    ├─── wasClusteredBefore && !isClustered (클러스터 → 개별)
    │         │
    │         ▼
    │    graph.setData(newData)
    │    graph.render()          ← force-layout 실행, 노드 분산 배치
    │
    └─── !wasClusteredBefore && isClustered (개별 → 클러스터)
              │
              ▼
         현재 노드 위치 캡처 (positionMap)
              │
              ▼
         새 데이터에 위치 할당:
           - 기존 노드 → 이전 좌표 유지
           - 클러스터 노드 → 멤버 노드 평균 좌표
              │
              ▼
         graph.setData(newData)
         graph.draw()            ← 레이아웃 없이 즉시 렌더
```

### 위치 할당 규칙

**개별 → 클러스터 전환 시:**

```
클러스터 위치 = 멤버 노드들의 (x, y) 산술 평균

예: 한국 클러스터
  RF-04 (200, 100)
  F-01  (220, 110)
  F-02  (210, 90)
  → 클러스터 위치: ((200+220+210)/3, (100+110+90)/3) = (210, 100)
```

**클러스터 → 개별 전환 시:**
- force-layout이 전체 노드를 처음부터 재배치
- 척력(`nodeStrength: -400`)과 충돌 방지(`collide`)로 겹침 자동 해소
- 시뮬레이션 수렴까지 ~100ms (14개 노드 기준)

### 판별 코드

```typescript
// 이전 클러스터링 상태 추적
const prevIsClusteredRef = useRef(isClustered);

useEffect(() => {
    const wasClusteredBefore = prevIsClusteredRef.current;
    prevIsClusteredRef.current = isClustered;

    // 클러스터 → 개별: force-layout 필요
    const needsLayout = wasClusteredBefore && !isClustered;

    if (needsLayout) {
        graph.setData(data);
        graph.render();   // force 시뮬레이션 실행
    } else {
        // 개별 → 클러스터: 위치 보존
        // ... positionMap 기반 좌표 할당 ...
        graph.setData(data);
        graph.draw();     // 즉시 렌더 (레이아웃 스킵)
    }
}, [isClustered, lodResult, ...]);
```

### 관련 파일

| 파일 | 역할 |
|------|------|
| `components/GraphRenderer.tsx` | 전환 로직 실행 (LOD useEffect) |
| `hooks/useLODClustering.ts` | `isClustered` 상태 계산 |
| `utils/clustering.ts` | `CLUSTER_ZOOM` 임계값, `computeLODClusters` 함수 |
