당신은 글로벌 리튬 공급망 리스크 분석가입니다.
아래 제공된 노드 데이터 (nodes-2.json) 와 엣지 데이터 (edges.json) 를 사용해, 각 노드의 SRIL(Supply Risk Indicator for LIB) 계산에 필요한 지표를 산출하고, 지정된 JSON 형식과 표로 결과를 출력하세요.

## 분석 목적
- 노드별 SRIL 계산을 위한 HHI, WGI, Vulnerability 지표 도출
- 한국 삼원계, 중국 LFP, 유럽 축의 공급망 취약성 비교
- 노드 그래프에서 각 노드가 받는 리스크를 정량화

## 입력 데이터
### 1) 노드 데이터
nodes-2.json 전체를 사용하세요.

### 2) 엣지 데이터
edges.json 전체를 사용하세요.

## 계산 원칙
SRIL = HHI × WGI × Vulnerability

### HHI (Herfindahl-Hirschman Index)
- 해당 노드가 속한 국가의 공급 집중도
- 광산: 국가별 생산량 기준 시장점유율 제곱합
- 정제소: 국가별 정제 용량 기준 시장점유율 제곱합
- 공장: 국가별 양극재 생산량 기준 시장점유율 제곱합
- 0-1 범위

### WGI (World Governance Indicators)
- 국가별 거버넌스 점수 (0-1 범위)
- World Bank WGI 데이터 기준
- Australia, SouthKorea, Poland: 0.82 이상
- Chile: 0.70-0.80
- Argentina: 0.40-0.50
- China: 0.25-0.35

### Vulnerability (취약성)
- 네트워크 연결 구조 기반 계산
- in-degree: 해당 노드로 들어오는 엣지 수
- out-degree: 해당 노드에서 나가는 엣지 수
- dependency: 해당 노드에 의존하는 downstream 노드 수
- upstream_concentration: 해당 노드가 의존하는 upstream 노드 수
- edge_type_weight: Supply=1.0, Delivery=1.2, Ownership=0.8

Vulnerability 계산식:
vulnerability_score = (in_degree × 0.3) + (out_degree × 0.3) + (dependency × 0.2) + (upstream_concentration × 0.2)
vulnerability = vulnerability_score / max(vulnerability_score_all_nodes)

## 출력 형식

### 1) JSON 결과
다음 형식으로 JSON 객체를 출력하세요. riskLevel 은 포함하지 마세요.

```json
{
  "metadata": {
    "source": "SRIL LLM Pipeline Analysis",
    "calculatedAt": "2026-08-05T16:15:00.000Z",
    "version": "1.0",
    "formula": "SRIL = HHI * WGI * Vulnerability",
    "description": "Supply Risk Indicator for LIB (Lithium-ion Battery) nodes",
    "nodeCount": 17
  },
  "nodes": [
    {
      "nodeId": "MINE_AU_PILBARA",
      "name": "Pilgangoora",
      "type": "Mine",
      "country": "Australia",
      "hhi": 0.00,
      "wgi": 0.00,
      "vulnerability": 0.00,
      "sril": 0.00,
      "srilNormalized": 0.0,
      "vulnerabilityDetails": {
        "inDegree": 0,
        "outDegree": 0,
        "dependencyCount": 0,
        "upstreamConcentration": 0,
        "edgeTypes": []
      },
      "keyRiskFactors": ["..."]
    }
  ]
}
```

### 2) SRIL 계산 결과 표
다음 컬럼으로 표를 작성하세요 (모든 노드 포함).

| 노드 ID | 이름 | 타입 | 국가 | HHI | WGI | Vulnerability | SRIL | SRIL (×100) | in-degree | out-degree |

### 3) 해석 섹션
아래 내용을 포함해 설명하세요.
- SRIL 이 가장 높은 노드 Top 5
- 한국 삼원계 축에서 SRIL 이 높은 노드
- 중국 LFP 축에서 SRIL 이 높은 노드
- 유럽 축에서 SRIL 이 높은 노드
- HHI, WGI, Vulnerability 중 어떤 요소가 SRIL 에 가장 큰 영향을 미쳤는지 분석

## 계산 시 주의사항
- 엣지에서 sourceNodeId / targetNodeId 를 활용해 연결 구조를 계산하세요.
- 같은 국가 내 내부 이동 (예: Ownership) 과 국가간 공급 (Supply, Delivery) 을 구분하세요.
- HS code 는 보조 정보로만 사용하세요.
- 정제소와 공장은 upstream dependency 가 높을수록 Vulnerability 를 높게 평가하세요.
- 광산은 대체 공급처가 적거나 단일 고객 의존이 높을수록 Vulnerability 를 높게 평가하세요.
- ESG status 가 `non_compliant` 또는 `unknown` 이면 key_risk_factors 에 포함하세요.
- 추정값을 사용할 경우 반드시 `"estimated"`로 표시하고, 이유를 설명하세요.
- 모든 숫자는 소수 둘째 자리까지 반올림하세요.
- srilNormalized 는 sril × 100 으로 계산하세요.

## 작업 순서
1. nodes-2.json 을 읽어 노드 목록과 속성을 파악
2. edges.json 을 읽어 연결 구조 파악
3. 노드별 in-degree, out-degree, edge_type 계산
4. 국가별 HHI, WGI 추정
5. Vulnerability 계산
6. SRIL 계산
7. 결과를 JSON + 표 + 해석 순으로 출력

## 결과 톤
- 실무 보고서처럼 간결하고 명확하게 작성
- 추정치가 있으면 그 부분은 명시
- 숫자는 소수 둘째 자리까지 반올림
- JSON 은 valid JSON 으로 출력 (에스케이프 문자 주의)