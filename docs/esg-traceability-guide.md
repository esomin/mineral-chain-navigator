# ESG 역추적(Traceability) 기능 설명서

## 1. 개요 — ESG 역추적이란

ESG 역추적은 배터리 공장(Factory)에서 사용하는 리튬 원재료가 **어떤 광산에서 채굴되어, 어떤 제련소를 거쳐 최종 제품에 도달했는지**를 추적하는 기능이다.

### 왜 필요한가

- **EU 배터리 규정(2027 시행)**: 배터리 여권(Battery Passport)에 원재료 출처 및 탄소 발자국 공개 의무화
- **미국 IRA(Inflation Reduction Act)**: FTA 체결국 원료 사용 비율에 따른 보조금 적격성 판단
- **ESG 투자자 요구**: 공급망 내 강제노동·환경파괴 리스크 확인

### 대상 범위

| 항목 | 범위 |
|------|------|
| 광물 | 리튬 산화물 및 수산화물 (HS Code 2825.20) |
| 대상 국가 | 한국, 일본, 중국, 칠레, 미국 (5개국) |
| 노드 수 | 14개 마스터 노드 (광산 3, 제련소 5, 공장 5, 리소스 1) |
| 기준 연도 | 2025년 |

### 기능이 제공하는 가치

- 특정 배터리 공장의 원재료 출처를 **경로 단위로 증명**
- 경로 상 ESG 인증이 누락된 구간을 **자동 식별 및 플래깅**
- 감사·실사 대응을 위한 **보고서 자동 생성**

---

## 2. 핵심 개념 — 업스트림 경로, ESG 상태, 플래깅

### 업스트림 경로(Upstream Path)

공급망에서 **다운스트림(Factory)에서 업스트림(Mine)으로 거슬러 올라가는 경로**를 의미한다.

```
Factory(배터리 공장) ← Refinery(제련소) ← Mine(광산)
```

하나의 Factory는 여러 Refinery로부터 공급받고, 각 Refinery는 또 다른 Mine에서 원재료를 조달하므로 **다수의 업스트림 경로**가 존재할 수 있다.

### ESG 준수 상태 (4단계)

각 노드(광산, 제련소, 공장)는 아래 4가지 ESG 상태 중 하나를 갖는다.

| 상태 | 의미 | 색상 표시 |
|------|------|----------|
| `compliant` | ESG 기준 충족 확인됨 | 🟢 녹색 |
| `non_compliant` | ESG 기준 미충족 확인됨 | 🔴 적색 |
| `unverified` | 인증 절차 미완료 | 🟡 황색 |
| `unknown` | 정보 없음 (상태 미입력) | ⚪ 회색 |

### 플래깅(Flagging)

경로 내에 `unverified` 또는 `unknown` 상태의 노드가 **하나라도 포함**되어 있으면, 해당 경로 전체가 "검증 필요" 상태로 플래깅된다. 이는 공급망 투명성에 공백이 있음을 의미하며, ESG 담당자의 후속 조치가 필요한 지점을 자동으로 알려준다.

---

## 3. 역추적 흐름 — Factory → Refinery → Mine 탐색 과정

### 탐색 원리

역추적은 **역방향 깊이 우선 탐색(Reverse DFS)**을 사용한다. 선택한 Factory 노드에서 시작하여 인바운드 엣지(해당 노드로 들어오는 공급 관계)를 따라 상류로 이동한다.

### 탐색 흐름도

```
┌─────────────────────────────────────────────────────┐
│  1. Factory 노드 선택 (예: EcoPro BM Pohang, F-01)  │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  2. 해당 Factory로 들어오는 Delivery 엣지 식별      │
│     → RF-01 (Ganfeng Xinyu), RF-04 (POSCO Gwangyang)│
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  3. 각 Refinery로 들어오는 Supply 엣지 추적         │
│     RF-01 ← M-01 (Salar de Atacama)                 │
│     RF-01 ← M-02 (Yichun Lepidolite)               │
│     RF-04 ← M-01 (Salar de Atacama)                 │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  4. Mine 노드 도달 → 경로 완성                      │
│     경로 A: F-01 ← RF-01 ← M-01                    │
│     경로 B: F-01 ← RF-01 ← M-02                    │
│     경로 C: F-01 ← RF-04 ← M-01                    │
└─────────────────────────────────────────────────────┘
```

### 탐색 규칙

- **종료 조건**: Mine 노드에 도달하면 유효한 역추적 경로로 확정
- **Resource 노드**: 도달 시 해당 분기 종료 (역추적 결과에 미포함)
- **순환 방지**: 이미 방문한 노드는 재방문하지 않음
- **전수 탐색**: 가능한 모든 경로를 빠짐없이 계산

---

## 4. 보고서 구조 — 원산지, 처리 단계, 인증, 플래깅 결과

역추적 보고서(`TraceabilityReport`)는 다음 4개 핵심 섹션으로 구성된다.

### 4.1 원산지(Source Origins)

공급망의 최상류에 해당하는 **광산(Mine) 노드 정보**를 정리한다.

| 필드 | 설명 | 예시 |
|------|------|------|
| 광산 ID | 노드 식별자 | M-01 |
| 광산명 | 시설 이름 | Salar de Atacama |
| 소재국 | 광산 위치 국가 | Chile |
| ESG 상태 | 해당 광산의 준수 상태 | compliant |
| 인증 | 보유 인증 목록 | IRMA Standard |

동일 광산이 여러 경로에 등장해도 **중복 없이 한 번만** 표시된다.

### 4.2 처리 단계(Processing Stages)

원재료가 최종 제품에 이르기까지 거치는 **중간 가공 시설** 정보를 나열한다.

| 필드 | 설명 | 예시 |
|------|------|------|
| 노드 ID | 시설 식별자 | RF-01 |
| 시설명 | 시설 이름 | Ganfeng Xinyu Plant |
| 노드 유형 | Factory / Refinery | Refinery |
| 소재국 | 시설 위치 국가 | China |
| ESG 상태 | 준수 상태 | unverified |
| 인증 | 보유 인증 | ISO 14001 |
| 처리 순서 | 공급망 내 위치 (0-based) | 1 |

### 4.3 인증 정보(All Certifications)

경로 상 모든 노드가 보유한 인증을 **중복 제거·알파벳 정렬**하여 종합 목록으로 제공한다.

예시: `["IATF 16949", "IRMA Standard", "ISO 14001", "ISO 9001"]`

이를 통해 현재 공급망에 어떤 인증이 커버되어 있는지, 어떤 인증이 부재한지를 한눈에 파악할 수 있다.

### 4.4 플래깅 결과(Flagged Paths)

ESG 상태가 `unverified` 또는 `unknown`인 노드를 포함하는 경로를 식별하여 보고한다.

| 필드 | 설명 |
|------|------|
| 경로 인덱스 | 전체 경로 목록 내 위치 |
| 미검증 노드 목록 | 해당 경로에서 문제가 되는 노드들 |
| 플래깅 사유 | 사람이 읽을 수 있는 설명 |

예시:
```
경로 #2: F-01 ← RF-01 ← M-02
플래깅 사유: "경로에 ESG 미검증 노드 포함: Yichun Lepidolite Mine"
미검증 노드: M-02 (esgStatus: unknown)
```

---

## 5. 사용 예시 — 특정 Factory 기준 역추적 시나리오

### 시나리오: EcoPro BM Pohang (F-01) 원재료 출처 증명

**배경**: EU 바이어가 F-01에서 생산한 양극재의 원재료 출처 증명을 요청했다.

**API 호출**:
```
GET /api/trace/F-01
```

**결과 요약**:

```json
{
  "factoryNodeId": "F-01",
  "factoryName": "EcoPro BM Pohang",
  "sourceOrigins": [
    { "mineNodeId": "M-01", "mineName": "Salar de Atacama", "country": "Chile", "esgStatus": "compliant" },
    { "mineNodeId": "M-02", "mineName": "Yichun Lepidolite Mine", "country": "China", "esgStatus": "unknown" }
  ],
  "processingStages": [
    { "nodeId": "F-01", "nodeName": "EcoPro BM Pohang", "nodeType": "Factory", "esgStatus": "compliant" },
    { "nodeId": "RF-01", "nodeName": "Ganfeng Xinyu Plant", "nodeType": "Refinery", "esgStatus": "unverified" },
    { "nodeId": "RF-04", "nodeName": "POSCO Gwangyang Plant", "nodeType": "Refinery", "esgStatus": "compliant" }
  ],
  "allCertifications": ["IRMA Standard", "ISO 14001", "ISO 9001"],
  "flaggedPaths": [
    {
      "pathIndex": 1,
      "reason": "경로에 ESG 미검증 노드 포함: Ganfeng Xinyu Plant, Yichun Lepidolite Mine"
    }
  ],
  "hasUnverifiedPaths": true
}
```

**해석 및 조치**:

1. ✅ 경로 A (M-01 → RF-04 → F-01): Chile 원산, POSCO 경유 — 전 구간 compliant. EU 바이어에 즉시 제출 가능.
2. ⚠️ 경로 B (M-02 → RF-01 → F-01): 중국 원산, Ganfeng 경유 — RF-01 unverified, M-02 unknown. 인증 요청 또는 해당 경로 물량 축소 검토 필요.

---

## 6. 시스템 구조 개요

### 모듈 구성

```
packages/
├── shared/src/types/traceability.ts   ← 타입 정의
├── core/src/traceability/
│   ├── compute-upstream-path.ts       ← 경로 탐색 (역방향 DFS)
│   └── generate-report.ts            ← 보고서 생성 + 플래깅
apps/
└── backend/src/controllers/           ← API 엔드포인트
```

### 핵심 함수

| 함수 | 역할 |
|------|------|
| `computeUpstreamPaths(factoryNodeId, nodes, edges)` | Factory에서 Mine까지 모든 업스트림 경로 계산 |
| `generateTraceabilityReport(result)` | 경로 결과를 보고서 형식으로 변환 |
| `flagUnverifiedPaths(result)` | 미검증 노드 포함 경로 식별 및 사유 생성 |

### 데이터 흐름

```
사용자 요청 → API (GET /api/trace/:factoryNodeId)
           → computeUpstreamPaths (경로 탐색)
           → generateTraceabilityReport (보고서 생성 + 플래깅)
           → JSON 응답 반환
```

---

## 7. 제약 사항 및 향후 계획

### 현재 제약 사항

| 항목 | 내용 |
|------|------|
| 노드 규모 | 14개 마스터 노드 한정 (실제 공급망은 수백 개) |
| ESG 데이터 | 수동 입력 방식 (메타데이터 필드 기반) |
| 실시간 갱신 | 미지원 — 시드 데이터 기반 스냅샷 분석 |
| 인증 검증 | 시스템 내 자동 유효성 확인 불가 (외부 DB 미연동) |
| 다단계 ESG | 개별 ESG 카테고리(환경·사회·거버넌스) 분리 미지원 |

### 향후 계획

- **외부 인증 DB 연동**: IRMA, RMI 등 공인 인증 데이터베이스와 API 연계하여 자동 상태 갱신
- **실시간 이벤트 기반 재계산**: 인증 만료·취소 이벤트 수신 시 관련 경로 자동 재플래깅
- **다중 광물 지원**: 코발트, 니켈 등 배터리 핵심 광물로 대상 확대
- **보고서 PDF 내보내기**: 감사용 공식 보고서 포맷 자동 생성
- **시뮬레이션 연계**: 특정 공급 경로 차단 시 대안 경로의 ESG 준수 상태 비교 분석
