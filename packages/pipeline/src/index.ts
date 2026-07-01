/**
 * @navigator/pipeline 패키지 진입점
 * 데이터 수집·가공 파이프라인 기능을 re-export한다.
 */

// 데이터 정규화
export { normalizeRecord } from './normalize.js';

// 무역 데이터 파싱
export { parseTradeData, COMTRADE_COUNTRY_CODES, HS_CODE_CATEGORIES, VALID_HS_CODE_SET } from './parse-trade-data.js';
export type { ComtradeRecord, TradeParseResult } from './parse-trade-data.js';

// 가격 데이터 로딩
export { loadPriceData, selectLatestPrice } from './load-price-data.js';
export type { PriceEntry, PriceDataFile, PriceLoadResult } from './load-price-data.js';

// 문서 인덱싱 파이프라인 (Phase 2)
export {
    chunkDocument,
    indexDocument,
    InMemoryVectorStore,
    createOpenAIEmbeddingProvider,
    createMockEmbeddingProvider,
} from './document-indexing/index.js';
