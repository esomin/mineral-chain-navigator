/**
 * 문서 인덱싱 파이프라인 모듈.
 *
 * 문서 청킹, 임베딩 생성, 벡터 저장을 수행한다.
 * 메타데이터(source, date, document_type)를 포함하며,
 * 파싱 실패 시 에러를 로깅하고 건너뛴다.
 */
export { chunkDocument } from './chunker.js';
export { indexDocument } from './index-document.js';
export { InMemoryVectorStore } from './vector-store.js';
export {
    createOpenAIEmbeddingProvider,
    createMockEmbeddingProvider,
} from './embedding.js';
