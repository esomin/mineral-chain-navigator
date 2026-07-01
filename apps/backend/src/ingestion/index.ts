/**
 * ingestion 진입점.
 * 파이프라인 로직은 @navigator/pipeline에서 re-export하고,
 * backend 전용 시드 데이터 로더만 여기서 직접 제공한다.
 */

// backend 전용: 시드 데이터 로더 (경로 계산 포함)
export { loadSeedData } from './load-seed-data.js';
export type { SeedDataResult } from './load-seed-data.js';

// @navigator/pipeline re-export: 파싱/정규화/가격 로딩 로직
export { normalizeRecord } from '@navigator/pipeline';
export { parseTradeData, COMTRADE_COUNTRY_CODES, HS_CODE_CATEGORIES, VALID_HS_CODE_SET } from '@navigator/pipeline';
export type { ComtradeRecord, TradeParseResult } from '@navigator/pipeline';
export { loadPriceData, selectLatestPrice } from '@navigator/pipeline';
export type { PriceDataFile, PriceEntry, PriceLoadResult } from '@navigator/pipeline';
