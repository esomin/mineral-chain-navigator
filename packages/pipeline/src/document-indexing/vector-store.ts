import type { DocumentChunk, VectorStore } from '@navigator/shared';

/**
 * 코사인 유사도를 계산한다.
 * 두 벡터가 정규화되어 있다면 내적과 동일하다.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    if (denominator === 0) {
        return 0;
    }

    return dotProduct / denominator;
}

/**
 * 인메모리 벡터 저장소.
 * Phase 2 초기 구현으로, 코사인 유사도 기반 검색을 지원한다.
 * 향후 PostgreSQL + pgvector로 교체할 수 있도록 VectorStore 인터페이스를 준수한다.
 */
export class InMemoryVectorStore implements VectorStore {
    private chunks: Map<string, DocumentChunk> = new Map();

    /** 문서 청크를 저장한다. */
    insertChunks(chunks: DocumentChunk[]): void {
        for (const chunk of chunks) {
            this.chunks.set(chunk.id, chunk);
        }
    }

    /**
     * 코사인 유사도 기반 top-K 검색을 수행한다.
     * 결과는 유사도 내림차순으로 정렬된다.
     */
    search(queryEmbedding: number[], topK: number): DocumentChunk[] {
        const scored: Array<{ chunk: DocumentChunk; similarity: number }> = [];

        for (const chunk of this.chunks.values()) {
            const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
            scored.push({ chunk, similarity });
        }

        scored.sort((a, b) => b.similarity - a.similarity);

        return scored.slice(0, topK).map((item) => item.chunk);
    }

    /** 특정 문서 ID에 해당하는 모든 청크를 반환한다. */
    getChunksByDocumentId(documentId: string): DocumentChunk[] {
        const result: DocumentChunk[] = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.documentId === documentId) {
                result.push(chunk);
            }
        }
        return result;
    }

    /** 특정 청크를 노드와 연관시킨다. */
    associateWithNode(chunkIds: string[], nodeId: string): void {
        for (const chunkId of chunkIds) {
            const chunk = this.chunks.get(chunkId);
            if (chunk) {
                if (!chunk.metadata.associatedNodeIds) {
                    chunk.metadata.associatedNodeIds = [];
                }
                if (!chunk.metadata.associatedNodeIds.includes(nodeId)) {
                    chunk.metadata.associatedNodeIds.push(nodeId);
                }
            }
        }
    }

    /** 저장된 모든 청크 수를 반환한다. */
    getChunkCount(): number {
        return this.chunks.size;
    }
}
