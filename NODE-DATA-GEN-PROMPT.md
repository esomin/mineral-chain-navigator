# 프로젝트 문서: 글로벌 리튬 공급망 노드 기준

## 1. 한국 삼원계 축 (리튬만)

### 1 단계: Mine (광산)

| 노드 ID | 광산명 | 국가 | 원료 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `MINE_AU_PILBARA` | 필간구라 (Pilgangoora) | 호주 | 리튬 | 755k 톤/년 | 포스코 |
| `MINE_AU_GREENBUSHES` | 그린부시스 (Greenbushes) | 호주 | 리튬 | 1,480k 톤/년 | LG 화학 |
| `MINE_CL_ATACAMA` | 아타카마 염호 (Atacama) | 칠레 | 리튬 | 210k 톤 LCE/년 | LG 화학 |

### 2 단계: Refinery (정제소)

| 노드 ID | 정제소명 | 국가 | 원료 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `REF_KR_POSCO_PILBARA` | 포스코필바라리튬솔루션 | 한국 | 리튬 | 43k 톤/년 | 포스코 |
| `REF_AR_POSCO` | 포스코아르헨티나 | 아르헨티나 | 리튬 | 25k 톤/년 | 포스코 |

### 3 단계: Plant (양극재 공장)

| 노드 ID | 공장명 | 국가 | 양극재 유형 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `MAT_KR_LG_CHEM` | LG 화학 | 한국 | NCM/NCA | 88k 톤/년 | 직접 연계 |
| `MAT_KR_ECOPRO_BM` | 에코프로비엠 | 한국 | NCM/NCA | 80k 톤/년 | 직접 연계 |
| `MAT_KR_POSCO_FUTUREM` | 포스코퓨처엠 | 한국 | NCM/LFP | 57k~72k 톤/년 | 직접 연계 |

***

## 2. 중국 LFP 축 (리튬만)

### 1 단계: Mine (광산)

| 노드 ID | 광산명 | 국가 | 원료 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `MINE_CL_SQM` | 칠레 SQM 염호 | 칠레 | 리튬 | 210k 톤 LCE/년 | 중국 LFP |
| `MINE_AR_SALTA` | 아르헨티나 살타 염호 | 아르헨티나 | 리튬 | - | 중국 LFP |

### 2 단계: Refinery (정제소)

| 노드 ID | 정제소명 | 국가 | 원료 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `REF_CN_LITHIUM` | 중국 리튬 정제소 | 중국 | 리튬 | - | 중국 LFP |

### 3 단계: Plant (양극재 공장)

| 노드 ID | 공장명 | 국가 | 양극재 유형 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `MAT_CN_HUNAN_YUNENG` | Hunan Yuneng | 중국 | LFP | 113.7 만 톤/년 | 비교용 |

***

## 3. 유럽 축 (리튬만)

### 1 단계: Mine (광산)

| 노드 ID | 광산명 | 국가 | 원료 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `MINE_AU_LITHIUM_EU` | 호주 리튬광산 | 호주 | 리튬 | - | Umicore |
| `MINE_CL_LITHIUM_EU` | 칠레 리튬염호 | 칠레 | 리튬 | - | Umicore |

### 2 단계: Refinery (정제소)

| 노드 ID | 정제소명 | 국가 | 원료 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `REF_KR_UMICORE` | Umicore 천안 | 한국 | 리튬 | 7~8 만 톤/년 | Umicore |

### 3 단계: Plant (양극재 공장)

| 노드 ID | 공장명 | 국가 | 양극재 유형 | 생산량 | 연계 |
|---|---|---|---|---|---|
| `MAT_PL_UMICORE` | Umicore 폴란드 | 폴란드 | NCM | 85 GWh (13.8 만 톤) | 비교용 |
| `MAT_KR_UMICORE` | Umicore 천안 | 한국 | NCM | 40 GWh (7~8 만 톤) | 비교용 |

***

## 4. 조사용 프롬프트

당신은 글로벌 리튬 공급망 데이터 수집 전문가입니다. 아래에 정의된 노드 목록 및 자료 조사 출처 지침을 기반으로 각 노드와 엣지의 상세 정보를 수집하여 지정된 JSON 형태로 각각 독립되게 출력하세요.

## 자료 조사 출처 및 방법 지침
1. 광산/공장 위치 및 좌표: Google Maps, S&P Global Market Intelligence, USGS 데이터를 기반으로 소수점 2자리 위경도 추출
2. 생산능력 및 소유 구조: 기업 공식 연차보고서(Annual Report), IR 발표 자료, 10-K 공시 및 공식 보도자료 확인
3. 품목 및 무역 분류: UN Comtrade 및 한국무역협회(KITA) HS 코드 체계 참조 (2530.90 리튬광, 2825.20 수산화리튬, 2836.91 탄산리튬, 2841.90 양극재 등)
4. ESG 및 인증: 기업 지속가능경영보고서 및 RMI, IRMA, ISO 인증(9001, 14001, 45001, IATF 16949) 현황 조사

## 엣지(Edge) 타입 정의 및 단계별 지정 규칙
엣지의 `type`은 리튬 공급망의 흐름 단계 `[Mine -> Refinery -> Factory]`에 따라 아래 규칙을 엄격히 적용하여 정의하세요.

1. **`Supply` (Mine -> Refinery)**:
   - **의미**: 원광, 염수 등 자연 상태의 원재료를 채굴하여 1차 정제소로 조달하는 상류(Upstream) 원천 관계.
   - **평가 요소**: 지정학적 채굴권, 원광 매장량 배분, 현지 가동률 등.
   
2. **`Delivery` (Refinery -> Factory / 타 기업 간)**:
   - **의미**: 정제된 리튬 화학물질(수산화리튬/탄산리튬)을 서로 다른 기업 간에 무역 및 실물 납품(수출입)하는 관계.
   - **평가 요소**: UN Comtrade 무역 통계, 해상 물류 리스크, FTA/IRA 법안 충족 여부 등.

3. **`Ownership` (Refinery -> Factory / 동일 그룹 내)**:
   - **의미**: 정제소와 양극재 공장이 동일한 기업 그룹(계열사)에 속해 있어 수직계열화 형태로 내부 이동하는 관계.
   - **평가 요소**: 그룹 내 자급률, 수직계열화 수급 안정성 등.

## 수집 대상 노드 목록

### 1. 한국 삼원계 축
#### 1 단계: Mine (광산)
- MINE_AU_PILBARA (필간구라, 호주, 리튬, 755k 톤/년, 포스코)
- MINE_AU_GREENBUSHES (그린부시스, 호주, 리튬, 1,480k 톤/년, LG 화학)
- MINE_CL_ATACAMA (아타카마 염호, 칠레, 리튬, 210k 톤 LCE/년, LG 화학)

#### 2 단계: Refinery (정제소)
- REF_KR_POSCO_PILBARA (포스코필바라리튬솔루션, 한국, 리튬, 43k 톤/년, 포스코)
- REF_AR_POSCO (포스코아르헨티나, 아르헨티나, 리튬, 25k 톤/년, 포스코)

#### 3 단계: Plant (양극재 공장)
- MAT_KR_LG_CHEM (LG 화학, 한국, NCM/NCA, 88k 톤/년)
- MAT_KR_ECOPRO_BM (에코프로비엠, 한국, NCM/NCA, 80k 톤/년)
- MAT_KR_POSCO_FUTUREM (포스코퓨처엠, 한국, NCM/LFP, 57k~72k 톤/년)

### 2. 중국 LFP 축
#### 1 단계: Mine (광산)
- MINE_CL_SQM (칠레 SQM 염호, 칠레, 리튬, 210k 톤 LCE/년)
- MINE_AR_SALTA (아르헨티나 살타 염호, 아르헨티나, 리튬)

#### 2 단계: Refinery (정제소)
- REF_CN_LITHIUM (중국 리튬 정제소, 중국, 리튬)

#### 3 단계: Plant (양극재 공장)
- MAT_CN_HUNAN_YUNENG (Hunan Yuneng, 중국, LFP, 113.7 만 톤/년)

### 3. 유럽 축
#### 1 단계: Mine (광산)
- MINE_AU_LITHIUM_EU (호주 리튬광산, 호주, 리튬)
- MINE_CL_LITHIUM_EU (칠레 리튬염호, 칠레, 리튬)

#### 2 단계: Refinery (정제소)
- REF_KR_UMICORE (Umicore 천안, 한국, 리튬, 7~8 만 톤/년)

#### 3 단계: Plant (양극재 공장)
- MAT_PL_UMICORE (Umicore 폴란드, 폴란드, NCM, 85 GWh)
- MAT_KR_UMICORE (Umicore 천안, 한국, NCM, 40 GWh)

## 수집할 정보 및 규격

1. **Node 정보**:
   - id: 노드 ID (목록의 ID 그대로 사용)
   - type: Mine | Refinery | Factory
   - name: 노드 이름
   - country: 영문 국가명
   - coordinates: 위도(lat), 경도(lng) (소수점 2자리)
   - metadata: 
     - productionCapacity: 생산능력 (숫자, 톤 단위 환산 / 1 GWh = 1,625톤)
     - capacityUnit: tons_cathode | tons_lithium | GWh
     - annualOutput: 연간 생산량 (숫자)
     - owner: 소유 기업
     - esgStatus: compliant | non_compliant | unknown
     - certifications: 인증 목록 배열 (예: ["ISO 14001", "RMI"])
   - description: 노드의 전략적 중요성 및 리스크 요인 (100자 이내)

2. **Edge 정보 (간결한 출발지-도착지 관계 중심)**:
   - id: "E-{source_node_id}-{target_node_id}"
   - type: Delivery | Ownership | Supply
   - source_node_id: 소스 노드 ID
   - target_node_id: 타겟 노드 ID
   - description: 노드 간 연결 관계 및 물류/소유 흐름 설명 (50자 이내)

## 출력 JSON 형식 (Nodes와 Edges 분리)

### 1. Nodes JSON 형식
```json
[
  {
    "id": "노드 ID",
    "type": "Mine|Refinery|Factory",
    "name": "노드명",
    "country": "국가명 (영문)",
    "coordinates": {
      "lat": 위도,
      "lng": 경도
    },
    "metadata": {
      "productionCapacity": 생산능력,
      "capacityUnit": "tons_cathode|tons_lithium|GWh",
      "annualOutput": 연간생산량,
      "owner": "소유기업",
      "esgStatus": "compliant|non_compliant|unknown",
      "certifications": ["인증1", "인증2"]
    },
    "description": "노드 설명"
  }
]
```

### 2. Edges JSON 형식
```json
[
  {
    "id": "E-소스노드ID-타겟노드ID",
    "type": "Delivery|Ownership|Supply",
    "source_node_id": "소스 노드 ID",
    "target_node_id": "타겟 노드 ID",
    "description": "연결 관계 설명"
  }
]

### 주의사항
1. 노드 ID는 주어진 규격을 엄격히 준수하세요.
2. 타임스탬프 속성(created_at, updated_at)은 생성하지 마세요.
3. 엣지 데이터에는 수량, 금액, HS 코드 등 무역 관련 상세 통계를 포함하지 말고 오직 관계 구조(소스, 타겟, 유형, 설명)만 포함하세요.
4. 최종 출력 시 Nodes JSON 배열 코드 블록과 Edges JSON 배열 코드 블록을 완전히 분리하여 각각 출력하세요.