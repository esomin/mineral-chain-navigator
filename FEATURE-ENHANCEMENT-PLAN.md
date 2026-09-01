# 대체 공급망 추천 및 경로 재설정 (Re-routing Engine) 기능 기획안
본 문서는 Lithium Supply Chain Navigator에서 공급망 충격 시나리오 발생 시 결손 물량을 보완하고, 최적의 우회 경로를 제안하는 '대체 공급망 자동 추천(Re-routing Engine)' 기능의 핵심 아이디어와 구현 방안을 정리한 문서입니다.

---

## 1. 개요 및 시스템 아키텍처

### 1.1 개요

공급망 시뮬레이션 결과 특정 노드에서 수급 차질(부족률 > 0%)이 감지되었을 때, 상류(Upstream) 제련소 및 광산의 여유 생산 능력을 파악하여 비용(Cost), 소요 시간(Lead Time), 미해소 물량(Penalty)을 종합 고려한 최적의 대체 우회 경로를 자동 계산해 제시합니다.

### 1.2 처리 흐름 (Pipeline)

```
[충격 감지 & 결손량 산출] ──> [후보 노드 스크리닝] ──> [최적화 알고리즘 연산] ──> [UI/UX 반영 & 시각화]
  • Deficit_i > 0% 식별        • 여유 캡파(Capacity > 0)    • Multi-Objective Optimization   • D3.js 기반 우회 경로
  • 결손 원자재 품목 확인      • 지정학적 락아웃 노드 제외   • Cost vs Lead Time 가중치 연산   • 초록색 점선 애니메이션

```

---

## 2. 핵심 연산 알고리즘 및 데이터 모델

### 2.1 연산 로직 & 목적 함수

* **1단계: 결손 발생 노드 탐색**
부족률($\text{Deficit}_i > 0$)이 발생한 노드 $i$ 및 해당 결손 품목(예: 수산화리튬) 식별.
* **2단계: 후보 노드 스크리닝 (Candidate Screening)**
동일 품목 생산이 가능한 상류 제련소/공장 중 현재 가동률 기준 여유 생산 능력($\text{Capacity}_{\text{available}} > 0$)이 존재하는 노드 추출 (수출 통제 등 지정학적 락아웃 노드 제외).
* **3단계: 다목적 최적화 연산 (Multi-Objective Optimization)**
유저가 선택한 옵션(비용 우선 / 운송시간 우선 / 밸런스)에 따라 가중치($w_1, w_2, w_3$)를 적용하여 정규화된 목적 함수를 최소화합니다.

$$\min \left( w_1 \cdot \text{Normalized Cost} + w_2 \cdot \text{Normalized LeadTime} + w_3 \cdot \sum_{i} \text{UnmetDeficit}_i \right)$$

* **옵션별 가중치 설정:**
* **비용 우선:** $w_1 = 0.8, w_2 = 0.2$
* **운송시간 우선:** $w_1 = 0.2, w_2 = 0.8$
* **밸런스:** $w_1 = 0.5, w_2 = 0.5$



---

### 2.2 확장 데이터 스키마 (Edge & Re-routing Schema)

#### ① Edge 데이터 구조 (물류 및 리드 타임 속성 추가)

```json
{
  "id": "E-RF01-F01",
  "type": "Delivery",
  "source_node_id": "RF-01",
  "target_node_id": "F-01",
  "attributes": {
    "hsCode": "2825.20",
    "year": 2025,
    "volume": 17984102,
    "price": 296752726,
    "unitPrice": 16.5,
    "priceType": "cif",
    "description": "China Ganfeng to Korea EcoPro",
    "logistics_info": {
      "transport_mode": "Maritime",
      "distance_km": 1450,
      "lead_time_days": 6.5,
      "customs_delay_days": 1.5,
      "total_lead_time_days": 8.0,
      "freight_cost_usd_per_ton": 850
    }
  },
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:00.000Z"
}

```

#### ② Re-routing Engine 연산 결과 출력 Schema

```json
{
  "simulation_id": "SIM-20260731-01",
  "target_node": "NODE-KR-POHANG-01",
  "defect_quantity_tons": 500,
  "rerouting_options": [
    {
      "rank": 1,
      "source_node_id": "NODE-CL-SQM-02",
      "source_name": "SQM Salar de Atacama (Chile)",
      "allocated_volume_tons": 350,
      "cost_impact": {
        "unit_extra_cost_usd": 1200,
        "total_extra_cost_usd": 420000
      },
      "lead_time_impact": {
        "base_days": 17,
        "additional_days": 5,
        "total_days": 22
      },
      "transport_type": "Maritime"
    },
    {
      "rank": 2,
      "source_node_id": "NODE-AU-TIANQI-01",
      "source_name": "Tianqi Kwinana (Australia)",
      "allocated_volume_tons": 150,
      "cost_impact": {
        "unit_extra_cost_usd": 450,
        "total_extra_cost_usd": 67500
      },
      "lead_time_impact": {
        "base_days": 12,
        "additional_days": 2,
        "total_days": 14
      },
      "transport_type": "Maritime"
    }
  ]
}

```

---

## 3. UI/UX 상세 설계

### 3.1 진입점 및 버튼 배치 (Button Placement)

* **진입 조건:** 시뮬레이션 실행 결과 부족률(Deficit)이 0% 초과하여 발생한 경우 활성화.
* **위치:** 중앙 패널의 **[결과 요약]** 박스 바로 하단에 **`[ 대체 경로 최적화 실행 ]`** 버튼 노출.

```
+---------------------------------------------------------------------------------+
| [결과 요약]                                                                     |
|    영향 노드: 1개   |   최대 부족률: 50.0%   |   실행 시간: 0.47ms               |
|    - EcoPro BM Pohang (한국, 공장) : 부족률 50.0%                                |
+---------------------------------------------------------------------------------+
| [ 대체 경로 최적화 실행 ] <--- (부족률 발생 시 하단에 노출되는 액션 버튼)        |
+---------------------------------------------------------------------------------+

```

---

### 3.2 우회 경로 추천 패널 (Re-routing Panel) UI 레이아웃

`대체 경로 최적화 실행` 클릭 시, 중앙 패널 하단에 추천 카드가 렌더링됩니다. (모든 이모지는 제거되었습니다.)

```
+---------------------------------------------------------------------------------+
| 대체 공급망 자동 추천 (Re-routing Suggestion)                                   |
| [최적화 기준: (o) 비용 우선   ( ) 운송시간 우선   ( ) 밸런스 ]                   |
+---------------------------------------------------------------------------------+
| [추천 1안] SQM Salar de Atacama (칠레, 제련소) 우회 물량 할당                    |
|    - 물량 배분: 부족분의 70% (35.0%p 커버)                                      |
|    - 추가 비용: +$1,200/ton (해상 운임 증가)                                    |
|    - 리드타임: +5일 소요 (총 22일)                                              |
|                                                                                 |
| [추천 2안] Tianqi Lithium Kwinana (호주, 제련소) 우회 물량 할당                  |
|    - 물량 배분: 부족분의 30% (15.0%p 커버)                                      |
|    - 추가 비용: +$450/ton                                                       |
|    - 리드타임: +2일 소요 (총 14일)                                              |
|                                                                                 |
| ------------------------------------------------------------------------------- |
| [최종 결과] 부족률 50.0% -> 0.0% (완전 해소 가능)                               |
| 예상 총 추가 비용: +$45,000 | 평균 추가 리드타임: +4.1일                          |
+---------------------------------------------------------------------------------+
| [ 우회 경로 시각화 적용 ]                          [ AI 보고서에 경로 반영 ]     |
+---------------------------------------------------------------------------------+

```

---

### 3.3 우측 네트워크 그래프 시각화 연동 (Visual Feedback)

* **대체 경로 선로 표현 (D3.js):**
* `[ 우회 경로 시각화 적용 ]` 클릭 시 우측 그래프 업데이트.
* **기존 차단/손상 엣지:** `stroke: #ff4d4f, stroke-dasharray: 5` (붉은색 점선)
* **신규 우회 엣지:** `stroke: #52c41a, stroke-dasharray: 3, animation: flow 1s infinite` (초록색 점선 흐름 애니메이션)


* **노드 상태 변경:**
* 물량이 정상 수급됨에 따라 붉은색 경고 테두리가 씌워졌던 target 노드(`EcoPro BM Pohang`)가 **정상(녹색/파란색) 테두리로 실시간 전환**.



---

## 4. 개발 스택 및 구현 전략 (Technical Architecture)

### 4.1 백엔드 아키텍처 (MSA 구조)

```
[Client (Frontend)] ──(HTTP/REST)──> [Node.js Express API Server]
                                            │
                                    (HTTP / gRPC)
                                            ▼
                                 [Python FastAPI Engine]
                                 • NetworkX (그래프 탐색)
                                 • SciPy / PuLP (최적화)

```

* **메인 API 서버:** Node.js + Express + TypeScript (기존 스택 유지 및 I/O 처리)
* **알고리즘 연산 전용 서버:** Python + FastAPI (NetworkX, SciPy 기반 최적화 엔진 구축)
* **장점:** 연산 전용 Microservice 분리로 Node.js 스레드 블로킹 방지, 향후 AI/LLM 리포트 기능 연동에 용이, MSA 아키텍처 역량 강조.



---

### 4.2 프론트엔드 그래프 시각화

* **라이브러리:** D3.js (SVG 기반 네트워크 그래프 제어)
* **CSS / Attribute 제어:**
```css
/* 차단된 엣지 */
.edge-blocked {
  stroke: #ff4d4f;
  stroke-dasharray: 5;
}

/* 활성화된 대체 우회 엣지 */
.edge-rerouted {
  stroke: #52c41a;
  stroke-dasharray: 3;
  animation: dash-flow 1s linear infinite;
}

@keyframes dash-flow {
  from { stroke-dashoffset: 6; }
  to { stroke-dashoffset: 0; }
}

```