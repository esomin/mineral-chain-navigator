# 시뮬레이션 실행 및 공급 부족 계산 플로우

본 문서는 공급망 분석 시스템에서 사용자가 시뮬레이션을 실행했을 때, 프론트엔드 UI 터치부터 시작하여 백엔드를 거쳐 코어 엔진의 공급 부족 계산 함수인 `calculateSupplyDeficit`이 호출되기까지의 전체 플로우와 영향 전파 경로 계산 함수인 `computePropagationPath`, 그리고 공급 부족 계산 함수인 `calculateSupplyDeficit`의 세부 로직을 설명합니다.

---

## 1. 시뮬레이션 호출 흐름 (Flow)

사용자가 프론트엔드 화면에서 시나리오를 구성하고 **시뮬레이션 실행** 버튼을 클릭하면, 데이터는 아래와 같은 흐름으로 전달되어 최종 계산을 수행합니다.

### 1.1. 전체 호출 흐름 요약

1. **사용자**: `SimulationPanel.tsx`에서 시뮬레이션 실행 버튼을 클릭합니다.
2. **프론트엔드 UI**: `handleRunSimulation()` 핸들러가 작동하여 `simulation-store.ts`의 `runSimulation()` 액션을 호출합니다.
3. **프론트엔드 스토어**: 3초 타임아웃 타이머를 시작하고, 백엔드의 `/api/simulation/run` 엔드포인트로 HTTP POST 요청을 보냅니다.
4. **백엔드 라우터**: `index.ts`에서 요청을 수신하여 `simulation-controller.ts`의 `runSimulation()` 메서드를 실행합니다.
5. **백엔드 컨트롤러**: 전체 노드 및 엣지 데이터를 조회한 후 코어 모듈의 `runSingleSimulation()` 함수를 호출합니다. (3초 타임아웃 처리 포함)
6. **코어 시뮬레이션 엔진**: `run-simulation.ts`에서 각 교란 이벤트(Disruption)별로 `computePropagationPath()`를 통해 영향 전파 경로를 계산합니다.
7. **공급 부족 계산**: 영향 전파 경로가 존재할 경우, `calculate-deficit.ts`의 `calculateSupplyDeficit()` 함수를 호출하여 각 노드의 공급 차단율 및 유입 물량을 연산합니다.
8. **결과 반환**: 연산된 결과(`SimulationResult`)를 역순으로 반환하여 프론트엔드 스토어 상태를 업데이트하고 화면에 결과를 렌더링합니다.

### 1.2. 단계별 세부 설명

#### 단계 1 & 2: 프론트엔드 UI 이벤트 트리거 및 스토어 액션 실행
- 사용자가 `SimulationPanel.tsx`에서 `▶ 시뮬레이션 실행` 버튼을 클릭하면 `handleRunSimulation` 핸들러가 트리거되며, Zustand 스토어의 `runSimulation`을 호출합니다.
- `simulation-store.ts`의 `runSimulation` 함수는 다음과 같은 작업을 수행합니다.
  1. 현재 구성된 교란 이벤트(`disruptions`) 목록을 취합하여 고유한 시나리오 객체(`DisruptionScenario`)를 생성합니다.
  2. 최대 3초의 시뮬레이션 제한 시간 타이머(`setTimeout`)와 화면 표시용 카운터(`setInterval`)를 실행합니다.
  3. `fetch('/api/simulation/run')` API를 통해 백엔드 서버에 `POST` 요청을 전송합니다.

#### 단계 3 & 4: 백엔드 라우터 및 컨트롤러 진입
- 백엔드 라우터인 `index.ts`의 `/api/simulation/run` 엔드포인트에서 요청을 수신합니다.
- 요청 바디에서 `scenario`를 추출 및 유효성 검사한 뒤 `simulation-controller.ts`의 `SimulationController.runSimulation(scenario)` 메서드를 호출합니다.
- `SimulationController`는 데이터 스토어로부터 전체 노드 및 엣지 정보를 조회하고, 이벤트 루프 차단을 피하기 위해 `runWithTimeout` 헬퍼를 통해 비동기 microtask 형태로 코어 엔진을 가동합니다.

#### 단계 5 & 6: 코어 엔진의 시뮬레이션 구동 및 공급 부족 계산
- 코어 패키지의 `run-simulation.ts`에 정의된 `runSingleSimulation` 함수가 실행됩니다.
- 시나리오에 포함된 각 교란(`disruption`)에 대해:
  1. 교란의 시작 대상이 노드인지 엣지인지에 따라 시작 노드(`startNodeId`)를 특정합니다.
  2. `computePropagationPath`를 호출하여 교란 영향이 뻗어나가는 경로(`PropagationPath`)를 동적으로 계산합니다.
  3. 계산 결과 전파 노드가 1개 이상 존재하면, `calculate-deficit.ts`의 `calculateSupplyDeficit(path, allNodes, allEdges)`를 호출하여 최종 공급량 변화 및 부족률을 연산합니다.
  4. 도출된 `DeficitResult` 정보들은 결과 배열(`deficits`)에 병합됩니다.

#### 단계 7 & 8: 결과 반환 및 프론트엔드 UI 업데이트
- 계산된 전체 결과(`SimulationResult`)는 컨트롤러 인메모리 맵에 저장되고, 프론트엔드로 JSON 형태로 반환됩니다.
- 스토어는 반환받은 결과를 상태로 저장하며, 화면에 하이라이트할 노드와 엣지 ID 목록(`highlightedPath`)을 파싱하여 그래프에 반영하고, `SimulationPanel.tsx` 하단에 결과 요약 및 노드별 부족률 순위 테이블을 표시합니다.

---

## 2. computePropagationPath 상세 로직 설명

`computePropagationPath` 함수는 너비 우선 탐색(BFS) 알고리즘을 활용하여, 최초로 교란이 발생한 지점(소스 노드 또는 엣지)으로부터 공급망 흐름의 다운스트림 방향으로 파급되는 영향 경로 및 각 단계에서의 누적 영향 감쇄 계수를 계산합니다.

### 2.1. 함수 시그니처 및 타입

```typescript
export function computePropagationPath(
    startNodeId: string,
    disruption: Disruption,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
    options?: {
        attenuationRate?: number;
        impactThreshold?: number;
    },
): PropagationPath
```

- **설정 옵션 및 기본값**:
  - `attenuationRate` (기본값: `0.7`): 영향 전파 감쇄율. 각 단계(step)를 거칠 때마다 충격 강도가 이 비율만큼 감소합니다. (즉, 단계당 영향이 30%씩 감쇄)
  - `impactThreshold` (기본값: `0.01`): 영향 전파 중단 임계값. 감쇄되어 계산된 영향력이 이 값 미만으로 떨어지면 하위 노드로 더 이상 전파하지 않습니다.

### 2.2. 내부 연산 및 탐색 알고리즘

#### 1. 시작점 검증 및 재정의
- 교란 대상 유형(`targetType`)이 `edge`인 경우:
  - 교란 대상인 엣지를 검색한 뒤, 엣지의 도착지 노드(`targetNodeId`)를 실제 BFS 탐색의 시작점으로 재설정합니다.
- 시작 대상 노드가 전체 노드 데이터베이스에 존재하는지 확인하여, 유효하지 않으면 즉시 빈 경로 데이터를 반환합니다.

#### 2. BFS 탐색 초기화 및 소스 정보 기록
- 순환 경로 탐색 및 무한 루프를 방지하기 위해 방문 목록(`visited` Set)을 생성합니다.
- 탐색 큐(`queue`)에 `{ nodeId: bfsStartNodeId, step: 0 }` 데이터를 최초 삽입합니다.
- 최초 영향 노드의 감쇄 계수(`attenuationFactor`)로 교란의 심각도(`disruption.severity`) 자체를 등록합니다.

#### 3. BFS 루프 실행 및 전파 한계 계산
큐가 빌 때까지 다음 연산을 수행합니다:
1. 큐에서 현재 노드 정보와 현재 단계(`step`)를 디큐(dequeue)합니다.
2. 다음 전파 단계의 영향력 수치(`nextImpact`)를 구합니다.
   $$\text{nextImpact} = \text{disruption.severity} \times (\text{attenuationRate})^{\text{step} + 1}$$
3. 계산된 `nextImpact`가 전파 임계값(`impactThreshold`) 미만이면 하위 전파를 생략(`continue`)하고 다음 노드를 처리합니다.
4. 현재 노드를 출발지로 하는 아웃바운드 엣지(즉, `sourceNodeId === nodeId`)들을 필터링합니다.
5. 발견된 모든 아웃바운드 엣지의 타겟 노드(`targetId`)에 대하여:
   - 이미 방문한 이력이 있는 노드는 건너뜁니다.
   - 타겟 노드가 노드 목록에 존재하는 경우, 방문 처리(`visited.add`) 후 결과 경로(노드 및 엣지 ID)에 추가하고, 감쇄 계수 목록에 해당 단계의 영향력(`nextImpact`)을 기록합니다.
   - 큐에 `{ nodeId: targetId, step: step + 1 }`을 푸시(enqueue)하여 하위 탐색을 이어갑니다.

---

## 3. calculateSupplyDeficit 상세 로직 설명

`calculateSupplyDeficit` 함수는 영향 전파 경로 상에 놓인 각 다운스트림 노드에 대하여, 유입 공급량 정보를 기반으로 실제 공급이 얼마나 교란되고 부족해지는지 구체적인 수치를 연산하는 역할을 담당합니다.

### 3.1. 함수 시그니처 및 타입

```typescript
export function calculateSupplyDeficit(
    path: PropagationPath,
    allNodes: SupplyChainNode[],
    allEdges: SupplyChainEdge[],
): DeficitResult[]
```

- **`path: PropagationPath`**: 교란의 전파 상태 정보를 가집니다.
  - `nodes: string[]`: 교란이 파급되는 순서대로 정렬된 노드 ID 목록. (0번째 인덱스는 교란의 원인이 되는 소스 노드)
  - `attenuationFactors: number[]`: 각 노드 위치에서의 누적 충격 감쇄 계수 (실제 공급의 차단율 역할을 수행하며 `[0, 1]` 범위의 비중값).
- **`allNodes`, `allEdges`**: 공급망 그래프 상의 모든 노드와 엣지 마스터 데이터.

### 3.2. 내부 연산 로직 세부 설명

함수는 `path.nodes` 배열에 포함된 모든 노드를 순회하며 아래 연산을 적용합니다.

#### 1. 인바운드 공급 유입량 합계 (`originalSupply`) 산출
각 노드로 직접 흘러 들어오는 인바운드 엣지(즉, 해당 노드가 `targetNodeId`인 엣지들)를 필터링하고, 각 엣지가 가진 물량 속성인 `volume`을 모두 합산합니다.
$$\text{originalSupply} = \sum (\text{edge.attributes.volume})$$

#### 2. 공급량이 없는 경우의 예외 처리
인바운드 엣지가 없거나 모든 인바운드 엣지의 `volume`의 합이 `0`인 노드(예: 최상위 광산 노드 등)의 경우에는 계산 오류 방지 및 공급 흐름 특성상 공급 손실율을 계산할 수 없으므로 무조건 아래 결과로 스킵합니다.
- `originalSupply = 0`
- `disruptedSupply = 0`
- `deficitPercentage = 0`

#### 3. 교란된 잔여 공급량 (`disruptedSupply`) 연산
해당 노드의 감쇄 계수(`attenuationFactor`)를 적용하여 교란이 발생한 후 유입되는 실제 공급량을 계산합니다. 감쇄 계수는 노드에 미치는 충격 강도(공급 차단율)이므로, 잔여 공급 비율은 `1 - attenuationFactor`가 됩니다.
$$\text{disruptedSupply} = \text{originalSupply} \times (1 - \text{attenuationFactor})$$

#### 4. 최종 공급 부족률 (`deficitPercentage`) 연산
감쇄 계수를 백분율(%)로 환산하여 해당 노드의 공급 부족 비중을 산출합니다. 이때 계산된 부족률이 논리적 범위인 `[0, 100]`을 벗어나지 않도록 클램핑 처리를 수행합니다.
$$\text{deficitPercentage} = \max(0, \min(100, \text{attenuationFactor} \times 100))$$

#### 5. 결과 목록 적재 및 반환
매 노드 단계마다 위 계산 결과들을 취합하여 `DeficitResult` 형태의 오브젝트로 빌드한 후 결과 배열에 추가하여 최종 반환합니다.

```typescript
interface DeficitResult {
    nodeId: string;            // 대상 노드 ID
    originalSupply: number;    // 원래의 총 유입 공급량 (Volume 합산)
    disruptedSupply: number;   // 교란 후 남은 공급량
    deficitPercentage: number; // 공급 부족률 (%)
}
```
