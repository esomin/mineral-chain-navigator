당신은 글로벌 리튬 공급망의 물류·운송 분석 전문가입니다.
입력으로 주어지는 edges.json (공급망 엣지 데이터)을 바탕으로, 각 엣지에 물류 정보를 추정하여 JSON을 생성하세요.

## 입력 데이터
- 파일명: edges.json
- 형식: 아래와 같은 배열
[
  {
    "id": "E-MINE_AU_PILBARA-REF_KR_POSCO_PILBARA",
    "type": "Supply",
    "sourceNodeId": "MINE_AU_PILBARA",
    "targetNodeId": "REF_KR_POSCO_PILBARA",
    "hsCode": "2530.90",
    "description": "호주 필간구라 광산에서 포스코필바라 정제소로 리튬 정광(스포듀민) 조달"
  },
  ...
]

sourceNodeId / targetNodeId 의 국가 정보와 실제 지리적 위치는 별도 nodes.json 에 있다고 가정하고,
당신은 LLM 수준의 상식과 국제 물류 관행을 활용해 **합리적인 추정값**을 채워 넣으세요.

## 출력 형식

다음과 같은 JSON 객체를 출력하세요 (전체 edges 기준):

```json
{
  "metadata": {
    "source": "LLM Logistics & Transportation Route Analysis",
    "calculatedAt": "<ISO 8601 형식의 현재 시각>",
    "version": "1.0",
    "description": "Logistics lead times, transport modes, and freight costs for supply chain edges",
    "totalEdgesCount": <edges.json 의 엣지 개수>,
    "defaultAssumptions": {
      "maritimeSpeedKnots": 18,
      "roadSpeedKmH": 60,
      "railSpeedKmH": 40
    }
  },
  "edges": [
    {
      "edgeId": "E-MINE_AU_PILBARA-REF_KR_POSCO_PILBARA",
      "sourceNodeId": "MINE_AU_PILBARA",
      "targetNodeId": "REF_KR_POSCO_PILBARA",
      "hsCode": "2530.90",
      "logisticsInfo": {
        "transportMode": "Maritime",
        "distanceKm": 5400,
        "leadTimeDays": 12.5,
        "customsDelayDays": 2.0,
        "totalLeadTimeDays": 14.5,
        "freightCostUsdPerTon": 85.0
      },
      "alternativeRoutes": [
        {
          "mode": "Air",
          "totalLeadTimeDays": 2.5,
          "freightCostUsdPerTon": 1200.0,
          "note": "Emergency backup for high urgency"
        }
      ]
    },
    {
      "edgeId": "E-REF_KR_POSCO_PILBARA-MAT_KR_POSCO_FUTUREM",
      "sourceNodeId": "REF_KR_POSCO_PILBARA",
      "targetNodeId": "MAT_KR_POSCO_FUTUREM",
      "hsCode": "2825.20",
      "logisticsInfo": {
        "transportMode": "Road",
        "distanceKm": 180,
        "leadTimeDays": 0.5,
        "customsDelayDays": 0.0,
        "totalLeadTimeDays": 0.5,
        "freightCostUsdPerTon": 25.0
      }
    }
  ]
}
```

### 필드 설명 및 규칙

1. **metadata**
   - `calculatedAt`: ISO 8601 형식의 현재 시각으로 설정 (예: `"2026-08-06T00:15:00.000Z"`).
   - `totalEdgesCount`: edges.json 배열 길이.
   - `defaultAssumptions`: 아래 값 사용
     - `maritimeSpeedKnots`: 18
     - `roadSpeedKmH`: 60
     - `railSpeedKmH`: 40

2. **edges 배열**
   - `edgeId`: 입력의 `id` 값을 그대로 사용.
   - `sourceNodeId`, `targetNodeId`, `hsCode`: 입력 값 그대로 복사.
   - `logisticsInfo`:
     - `transportMode`: 다음 기준으로 선택
       - **국가 간 해상 이동**: `"Maritime"`
         - 예: 호주→한국, 칠레→중국, 호주→한국→유럽 등
       - **동일 국가 내 단거리 이동**: `"Road"`
         - 예: 한국 내 정제소→공장, 중국 내 정제소→공장
       - 필요 시 `"Rail"` 도 사용할 수 있음 (내륙 장거리 운송 시).
     - `distanceKm`: 대륙/도시간 평균 항로 또는 도로 거리 기반 합리적 추정값
       - 예) 호주 서부 항구 ↔ 여수/광양: 약 4,000~6,000km 수준
       - 예) 한국 내 광양↔광양/포항: 100~300km 수준
     - `leadTimeDays`:
       - `distanceKm` 와 `transportMode` 기반 계산 (대략)
         - Maritime: 하루 700~800km (18 knots 기준) 로 추정
         - Road: 하루 500~700km 로 추정
         - Rail: 하루 800~1000km 로 추정
       - 항만 적재/하역, 터미널 처리 시간을 포함해 **반올림된 값** 사용
     - `customsDelayDays`:
       - 국경을 넘는 경우(수출입): 1.0~3.0일 정도로 설정
       - 국내 이동만 있는 경우: 0.0
     - `totalLeadTimeDays`:
       - `leadTimeDays + customsDelayDays`
     - `freightCostUsdPerTon`:
       - Maritime: 장거리 벌크 화물 기준 50~150 USD/톤 범위에서, 거리/구간 난이도에 따라 설정
       - Road: 20~80 USD/톤 범위에서, 거리·국가별 물류비 수준 고려
       - Rail: 해상 대비 중간 수준으로 설정 (예: 60~120 USD/톤)
       - 고가 긴급 운송이 아닌 일반 정기 물류 수준을 기준으로 합리적 값 사용

3. **alternativeRoutes (선택)**
   - 고위험·장거리 해상 구간의 경우 예시처럼 `alternativeRoutes` 를 추가할 수 있음
     - 예) `mode`: `"Air"`, `"Rail+Truck"` 등
     - `totalLeadTimeDays`: 현저히 짧지만,
     - `freightCostUsdPerTon`: 매우 높은 값 (예: 1000 USD/톤 이상) 으로 설정
     - `note`: 긴급 상황용 백업 루트임을 명시

### 구현 기준

- 모든 엣지에 대해 `logisticsInfo` 를 반드시 채우세요.
- `distanceKm`, `leadTimeDays`, `freightCostUsdPerTon` 은 **정확한 실측치가 아니라, 업계 평균과 지리 상식을 활용한 “합리적 추정값”** 임을 전제합니다.
- 입력 edges.json 에 존재하지 않는 엣지는 생성하지 않습니다.
- 출력은 **유효한 JSON** 이어야 하며, 마지막에 쉼표가 들어가지 않도록 주의하세요.
- 숫자는 소수 한 자리 또는 두 자리까지 사용하되, 전체적으로 일관된 포맷을 유지하세요.

## 작업 순서
1. edges.json 을 읽어 edgeId, sourceNodeId, targetNodeId, hsCode, description 을 파악합니다.
2. source/target 의 국가와 위치(도시·항만)를 추론하고, 주 운송 모드를 결정합니다.
3. 추정 거리(km)를 설정하고, 모드별 평균 속도 가정으로 leadTimeDays 를 계산합니다.
4. 국경 통과 여부에 따라 customsDelayDays 를 설정하고 totalLeadTimeDays 를 계산합니다.
5. 구간 난이도와 거리, 모드를 고려해 freightCostUsdPerTon 을 설정합니다.
6. 모든 엣지에 대해 logisticsInfo (및 필요한 경우 alternativeRoutes) 를 채워 JSON 스키마에 맞게 출력합니다.