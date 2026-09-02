# 시드 데이터 목록 및 연동 가이드

2025년 기준 리튬(HS 2825.20) 공급망 MVP에 필요한 시드 데이터 파일 현황 및 애플리케이션 연동 구조입니다.
대상: 5개국(한국, 일본, 중국, 칠레, 미국), 14개 마스터 노드.

---

## 1. 주요 데이터 파일별 사용처 및 연동 흐름

외부 기관(USGS, UN Comtrade, World Bank, IEA 등)에서 수집 및 정제된 데이터는 애플리케이션의 메모리 데이터스토어, 리스크 엔진, AI 인사이트 서비스로 전달되어 구동됩니다.

### 데이터 디렉토리 구조
```
packages/pipeline/data/
├── nodes.json                    # 14개 마스터 노드 (광산, 제련소, 배터리 공장 등)
├── edges.json                    # 공급망 연결선 (무역량, 리드타임, 운송비, IRA 규제)
├── logistics/
│   └── logistics-edges.json      # 상세 물류 경로 (항구, 운송수단, 대체 우회경로)
├── risk-factors/
│   └── sril-scores.json          # WGI 거버넌스 및 시장집중도 기반 SRIL 리스크 점수
├── prices/
│   └── comtrade-unit-prices.json # HS코드별 및 국가별 단가 통계 (USD/kg, USD/ton)
└── raw/comtrade/
    └── comtrade-api-response.json # UN Comtrade 2025 무역 통계 원본 데이터
```

### 데이터 파일별 세부 사용처 및 연동 흐름

| 데이터 파일 | 데이터 소스 | 연동 모듈 및 흐름 | 최종 사용 기능 |
|---|---|---|---|
| `nodes.json` | USGS MCS2026, 기업 공시 큐레이션 | loadSeedData -> InMemoryStore -> /api/graph/nodes | 3D Globe 및 2D 토폴로지 맵 노드 시각화, 노드 상세 모달 |
| `edges.json` | UN Comtrade, 물류사 운임 데이터 | loadSeedData -> InMemoryStore -> /api/graph/edges | 공급망 흐름선 시각화, 공급 충격 시뮬레이션, 병목 분석 |
| `logistics/logistics-edges.json` | 해운 및 항공 물류 데이터 | loadSeedData -> edges.json 속성 병합 (logisticsInfo) | 대체 우회 운송로 추천, 물류 리드타임 및 운임 상세 조회 |
| `risk-factors/sril-scores.json` | World Bank WGI 2024, USGS HHI | RiskController -> /api/risk/* | 국가 거버넌스 리스크, 시장 집중도 리스크, 종합 위험도 산출 |
| `prices/comtrade-unit-prices.json` | UN Comtrade API 2025 무역 데이터 | extract-unit-prices.ts -> 파이프라인 가공 산출물 | HS코드별 가중평균 거래단가 분석 및 운송비 산정 참조 |
| `packages/database/src/seed/*.txt` | IEA Outlook 2025, USGS MCS2025 | DocumentController -> InMemoryVectorStore | AI 인사이트 질의응답 및 공급망 대안 추천(RAG 출처) |

---

## 2. 원시 소스 데이터 현황

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `usgs-prod-reserves.json` | 리튬 국가별 생산량(2024확정/2025추정) 및 매장량 | USGS MCS2026 | 완료 |
| `raw/comtrade/comtrade-api-response.json` | HS 282520 무역 통계 원시 API 응답 (2025, 한국/일본 수입) | UN Comtrade API | 완료 |
| `komis-price.json` | LiOH 56.5%min FOB China 월별 시세 (2025-07~2026-06) | KOMIS | 완료 |

---

## 3. 노드 및 엣지 데이터

### 노드 구성 (`nodes.json`)
* Resource (1개): R-01 (Global Lithium Reserves)
* Mine (3개): M-01 (Salar de Atacama), M-02 (Yichun Lepidolite Mine), M-03 (Silver Peak)
* Refinery (5개): RF-01 (Ganfeng Xinyu), RF-02 (Tianqi Shehong), RF-03 (SQM Salar del Carmen), RF-04 (POSCO Gwangyang), RF-05 (Piedmont Tennessee)
* Factory (5개): F-01 (EcoPro BM Pohang), F-02 (LG Energy Solution Ochang), F-03 (Panasonic Wakayama), F-04 (CATL Ningde), F-05 (Tesla Giga Nevada)

### 엣지 구성 (`edges.json`, `logistics/logistics-edges.json`)
* Mine -> Refinery: 원광 및 정광 공급 흐름
* Refinery -> Factory: 탄산리튬 및 수산화리튬 납품 흐름
* 항구 간 해상 운송로, 육상 내륙 운송로, 대체 우회 운송 경로 속성 포함

---

## 4. 데이터 소스 정보 및 기준 연도

* 프로젝트 기준 연도: 2025년
* USGS MCS2026: 2025년 추정 생산량 및 매장량 데이터
* UN Comtrade: HS 2825.20 무역 통계 데이터
* World Bank WGI 2024: 5개국 거버넌스 지표 (정치 안정성, 규제 품질)
* 한국자원정보서비스(KOMIS): LiOH 56.5%min FOB China 12개월 시세
