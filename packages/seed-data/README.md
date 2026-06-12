# 시드 데이터 목록

2025년 기준 리튬(HS 2825.20) 공급망 MVP에 필요한 시드 데이터 파일 현황.
대상: 5개국(한국, 일본, 중국, 칠레, 미국), 14개 마스터 노드.

## 원시 소스 데이터

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `usgs-prod-reserves.json` | USGS 리튬 생산량/매장량 데이터 | USGS MCS | ✅ 완료 |
| `comtrade-api-response.json` | HS 2825.20 무역 통계 원시 응답 | UN Comtrade API | ✅ 완료 |
| `komis-price.json` | LiOH 시세 원시 데이터 | KOMIS | ✅ 완료 |

## 노드 데이터 (`nodes/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `nodes/resource.json` | R-01: Global Lithium Reserves (1개) | MCS 추출 | ⬜ TODO |
| `nodes/mines.json` | M-01~M-03: 광산 3개 (좌표 포함) | 수동 큐레이션 | ⬜ TODO |
| `nodes/refineries.json` | RF-01~RF-05: 제련소 5개 (좌표 포함) | 수동 큐레이션 | ⬜ TODO |
| `nodes/factories.json` | F-01~F-05: 배터리 공장 5개 (좌표 포함) | 수동 큐레이션 | ⬜ TODO |

## 엣지 데이터 (`edges/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `edges/supply-chains.json` | Mine→Refinery Supply 관계 | 수동 구성 | ⬜ TODO |
| `edges/trade-flows.json` | Refinery→Factory Delivery + 무역량 | comtrade-api-response 기반 | ⬜ TODO |

## 가격 데이터 (`prices/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `prices/lithium-prices.json` | LiOH 월별 가격 12개월 (2025-06~2026-05) | komis-price.json 가공 | ⬜ TODO |

## 리스크 팩터 (`risk-factors/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `risk-factors/production-shares.json` | 리튬 국가별 생산 점유율 + HHI | MCS에서 자동 생성 | ✅ 완료 |
| `risk-factors/wgi-scores.json` | 5개국 WGI (Political Stability + Regulatory Quality) | World Bank WGI 2024 | ✅ 완료 |

## 스크립트 (`scripts/`)

| 파일 | 용도 | 상태 |
|------|------|------|
| `scripts/extract-lithium-production.ts` | MCS → production-shares.json 자동 생성 | ✅ 완료 |

---

## 데이터 소스 정보

| 소스 | URL | 데이터 | 비고 |
|------|-----|--------|------|
| USGS MCS2025/2026 | https://data.usgs.gov | 광물별 국가 생산량/매장량 | CSV, 무료 |
| 한국자원정보서비스(KOMIS) | https://www.komis.or.kr | LiOH 56.5%min FOB China, USD/kg | 월별 시세 |
| World Bank WGI | https://info.worldbank.org/governance/wgi/ | 국가별 거버넌스 지수 (0~100, 2025 개정) | 무료 |
| UN Comtrade | https://comtradeplus.un.org | HS 2825.20 무역 통계 | JSON API, 무료 tier |

## 기준 연도 정책

프로젝트 기준 연도: **2025년**

| 데이터 유형 | 기준 연도 | 소스 | 비고 |
|------------|----------|------|------|
| 생산량/매장량 | **2025 (MCS2026 추정치)** | USGS MCS2026 | MCS2026 입수 전까지 MCS2025의 2024 추정치 임시 사용 |
| 무역 데이터 | **2025** | UN Comtrade | HS 2825.20 기준 |
| WGI 점수 | **2024** | World Bank WGI | 2025 개정 방법론, 0~100점 절대 점수 |
| 리튬 가격 | **2025-06~2026-05** | KOMIS | LiOH FOB China USD/kg 최근 12개월 |

---

## 대상 국가 (5개국)

| 국가 | 역할 | 노드 |
|------|------|------|
| 한국 (South Korea) | 양극재 + 배터리 제조 | RF-04, F-01, F-02 |
| 일본 (Japan) | 배터리 제조 | F-03 |
| 중국 (China) | 채굴 + 정제 + 배터리 | M-02, RF-01, RF-02, F-04 |
| 칠레 (Chile) | 채굴 + 정제 | M-01, RF-03 |
| 미국 (United States) | 채굴 + 정제 + 배터리 (IRA) | M-03, RF-05, F-05 |

## 14개 마스터 노드

### Resource (1개)

| ID | 이름 | 설명 |
|----|------|------|
| R-01 | Global Lithium Reserves | 전 세계 리튬 매장량 총량 기준점 |

### Mine (3개)

| ID | 이름 | 국가 | 2025 규모 |
|----|------|------|----------|
| M-01 | Salar de Atacama | 칠레 | ~200,000+ t LCE |
| M-02 | Yichun Lepidolite Mine | 중국 | ~60,000+ t LCE |
| M-03 | Silver Peak | 미국 | ~5,000 t LCE |

### Refinery (5개)

| ID | 이름 | 국가 | 2025 규모 |
|----|------|------|----------|
| RF-01 | Ganfeng Xinyu Plant | 중국 | ~100,000+ t |
| RF-02 | Tianqi Shehong Plant | 중국 | ~50,000+ t |
| RF-03 | SQM Salar del Carmen | 칠레 | ~40,000+ t |
| RF-04 | POSCO Gwangyang Plant | 한국 | ~40,000 t |
| RF-05 | Piedmont Tennessee | 미국 | ~30,000 t |

### Factory (5개)

| ID | 이름 | 국가 | 2025 규모 |
|----|------|------|----------|
| F-01 | EcoPro BM Pohang | 한국 | ~100,000+ t (양극재) |
| F-02 | LG Energy Solution Ochang | 한국 | ~30+ GWh |
| F-03 | Panasonic Wakayama | 일본 | ~10+ GWh |
| F-04 | CATL Ningde Gigafactory | 중국 | ~100+ GWh |
| F-05 | Tesla Giga Nevada | 미국 | ~40+ GWh |

---

## 실행 방법

```bash
# production-shares.json 재생성
npx tsx packages/seed-data/scripts/extract-lithium-production.ts
```
