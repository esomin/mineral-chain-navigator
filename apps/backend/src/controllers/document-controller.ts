import type {
    RawDocument,
    IndexResult,
    DocumentChunk,
    VectorStore,
    EmbeddingProvider,
    ChunkingOptions,
} from '@navigator/shared';
import { indexDocument } from '@navigator/pipeline';

/**
 * 문서 인덱싱 및 검색 컨트롤러.
 * 벡터 저장소와 임베딩 제공자를 조합하여 문서를 인덱싱하고 검색한다.
 */
export class DocumentController {
    constructor(
        private readonly vectorStore: VectorStore,
        private readonly embeddingProvider: EmbeddingProvider,
        private readonly chunkingOptions?: ChunkingOptions,
    ) { }

    /**
     * 문서를 인덱싱한다.
     * 문서를 청킹하고, 임베딩을 생성하며, 벡터 저장소에 저장한다.
     */
    async indexDocument(doc: RawDocument): Promise<IndexResult> {
        return indexDocument(doc, this.vectorStore, this.embeddingProvider, this.chunkingOptions);
    }

    /**
     * 텍스트 쿼리로 유사 문서 청크를 검색한다.
     */
    async search(query: string, topK: number = 5): Promise<DocumentChunk[]> {
        const queryEmbedding = await this.embeddingProvider(query);
        return this.vectorStore.search(queryEmbedding, topK);
    }

    /**
     * 특정 청크들을 노드와 연관시킨다.
     */
    associateWithNode(chunkIds: string[], nodeId: string): void {
        this.vectorStore.associateWithNode(chunkIds, nodeId);
    }

    /**
     * 저장된 청크 총 수를 반환한다.
     */
    getChunkCount(): number {
        return this.vectorStore.getChunkCount();
    }
}
