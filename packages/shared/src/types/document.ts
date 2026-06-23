// Document & Vector Search Types (Phase 2)

export type DocumentType = 'policy' | 'technical_report' | 'regulation' | 'news';

export interface ChunkMetadata {
    source: string;
    date: Date;
    documentType: DocumentType;
    pageNumber?: number;
    associatedNodeIds?: string[];
}

export interface DocumentChunk {
    id: string;
    documentId: string;
    content: string;
    embedding: number[];  // 1536-dim vector (OpenAI text-embedding-3-small)
    metadata: ChunkMetadata;
}

export interface IndexedDocument {
    id: string;
    source: string;
    date: Date;
    documentType: DocumentType;
    chunks: DocumentChunk[];
}

/**
 * 문서 인덱싱 요청 입력.
 */
export interface RawDocument {
    /** 문서 제목 또는 파일명 */
    title: string;
    /** 문서 본문 (plain text) */
    content: string;
    /** 출처 (예: USGS, IEA, Korea Customs) */
    source: string;
    /** 문서 발행일 */
    date: Date | string;
    /** 문서 유형 */
    documentType: DocumentType;
}

/**
 * 문서 인덱싱 결과.
 */
export interface IndexResult {
    success: boolean;
    documentId: string;
    chunksIndexed: number;
    errors: string[];
}

/**
 * 벡터 저장소 인터페이스.
 * InMemoryVectorStore 및 향후 PgVectorStore 모두 이 인터페이스를 구현한다.
 */
export interface VectorStore {
    /** 문서 청크를 저장한다. */
    insertChunks(chunks: DocumentChunk[]): void;
    /** 코사인 유사도 기반 top-K 검색을 수행한다. */
    search(queryEmbedding: number[], topK: number): DocumentChunk[];
    /** 특정 문서 ID에 해당하는 모든 청크를 반환한다. */
    getChunksByDocumentId(documentId: string): DocumentChunk[];
    /** 특정 청크를 노드와 연관시킨다. */
    associateWithNode(chunkIds: string[], nodeId: string): void;
    /** 저장된 모든 청크 수를 반환한다. */
    getChunkCount(): number;
}

/**
 * 임베딩 생성 함수 인터페이스.
 * OpenAI API, 로컬 모델 등 다양한 임베딩 제공자를 추상화한다.
 */
export type EmbeddingProvider = (text: string) => Promise<number[]>;

/**
 * 청킹 옵션.
 */
export interface ChunkingOptions {
    /** 청크 최대 길이 (문자 수). 기본값: 1000 */
    maxChunkSize?: number;
    /** 청크 간 오버랩 (문자 수). 기본값: 200 */
    overlap?: number;
}
