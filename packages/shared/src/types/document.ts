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
    embedding: number[];  // 1536-dim vector (OpenAI ada-002)
    metadata: ChunkMetadata;
}

export interface IndexedDocument {
    id: string;
    source: string;
    date: Date;
    documentType: DocumentType;
    chunks: DocumentChunk[];
}
