# 시드 데이터 목록

리튬 공급망 MVP에 필요한 시드 데이터 파일 현황.

## 원시 소스 데이터

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `usgs-mcs2025-rsource.json` | USGS MCS2025 전체 광물 데이터 (88종) | USGS ScienceBase | v 완료 |

## 노드 데이터 (`nodes/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `nodes/resource.json` | 리튬 Resource 노드 1개 | MCS2025에서 추출 | ⬜ TODO |
| `nodes/mines.json` | 주요 리튬 광산 6개 (좌표 포함) | 수동 큐레이션 (USGS MRDS) | ⬜ TODO |
| `nodes/refineries.json` | 리튬 제련소 4개 (좌표 포함) | 수동 큐레이션 | ⬜ TODO |
| `nodes/factories.json` | 배터리 공장 4개 (좌표 포함) | 수동 큐레이션 | ⬜ TODO |

## 엣지 데이터 (`edges/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `edges/supply-chains.json` | Mine→Refinery→Factory 공급 관계 15~20건 | 수동 구성 | ⬜ TODO |
| `edges/trade-flows.json` | 국가 간 리튬 무역 데이터 10~15건 | UN Comtrade 또는 수동 | ⬜ TODO |

## 가격 데이터 (`prices/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `prices/lithium-prices.json` | LiOH 월별 가격 12개월 (2025-06~2026-05) | 한국자원정보서비스(KOMIS) | ⬜ TODO |

## 리스크 팩터 (`risk-factors/`)

| 파일 | 내용 | 소스 | 상태 |
|------|------|------|------|
| `risk-factors/production-shares.json` | 리튬 국가별 생산 점유율 + HHI | MCS2025에서 자동 생성 | v 완료 |
| `risk-factors/wgi-scores.json` | 5개국 WGI 정치안정성 점수 | World Bank WGI | ⬜ TODO |

## 스크립트 (`scripts/`)

| 파일 | 용도 | 상태 |
|------|------|------|
| `scripts/extract-lithium-production.ts` | MCS2025 → production-shares.json 자동 생성 | v 완료 |

---

## 데이터 소스 정보

| 소스 | URL | 데이터 | 비고 |
|------|-----|--------|------|
| USGS MCS2025 | https://data.usgs.gov | 광물별 국가 생산량/매장량 | CSV, 무료 |
| 한국자원정보서비스(KOMIS) | https://www.komis.or.kr | 리튬 시세 (LiOH FOB China, USD/kg) | 최근 12개월 월별 |
| World Bank WGI | https://info.worldbank.org/governance/wgi/ | 국가별 정치안정성 지수 | CSV, 무료, 2년 지연 |
| UN Comtrade | https://comtradeplus.un.org | HS Code 무역 통계 | JSON API, 무료 tier |

## 기준 연도 정책

| 데이터 유형 | 기준 연도 | 근거 |
|------------|----------|------|
| 생산량/매장량 | 2024 (MCS2025 추정치) | `PROD_EST_2024` 사용 |
| 무역 데이터 | 2024 | UN Comtrade 2024 완전 공개 |
| WGI 점수 | 2023 | WGI 구조적 2년 지연 |
| 리튬 가격 | 2025-06~2026-05 (최근 12개월) | KOMIS 실시간 시세 |

---

## 대상 국가 (5개국)

| 국가 | 역할 |
|------|------|
| 호주 (Australia) | 리튬 채굴 (세계 1위) |
| 칠레 (Chile) | 리튬 채굴 (세계 2위, 염수) |
| 중국 (China) | 채굴 + 정제 + 배터리 제조 |
| 한국 (South Korea) | 배터리 제조 (소비국) |
| 일본 (Japan) | 배터리 제조 (소비국) |

## 대상 시설 후보

### 광산 (Mine) — 6개

| 이름 | 국가 | 유형 |
|------|------|------|
| Greenbushes | 호주 | 경암 (Spodumene) |
| Pilgangoora | 호주 | 경암 |
| Mt Cattlin | 호주 | 경암 |
| Salar de Atacama | 칠레 | 염수 (Brine) |
| Salar del Carmen | 칠레 | 염수 |
| Jiangxi (宜春) | 중국 | 경암 |

### 제련소 (Refinery) — 4개

| 이름 | 국가 |
|------|------|
| Tianqi Lithium Kwinana | 호주 |
| Ganfeng Xinyu | 중국 |
| SQM Salar del Carmen Plant | 칠레 |
| Albemarle Chengdu | 중국 |

### 배터리 공장 (Factory) — 4개

| 이름 | 국가 |
|------|------|
| CATL Ningde | 중국 |
| LG Energy Solution Ochang | 한국 |
| Samsung SDI Cheonan | 한국 |
| Panasonic Sumoto | 일본 |

---

## 실행 방법

```bash
# production-shares.json 재생성
npx tsx packages/seed-data/scripts/extract-lithium-production.ts
```
