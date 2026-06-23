import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVectorStore } from './vector-store.js';
import type { DocumentChunk } from '@navigator/shared';

describe('InMemoryVectorStore', () => {
    let store: InMemoryVectorStore;

    beforeEach(() => {
        store = new InMemoryVectorStore();
    });

    function createChunk(
        id: string,
        documentId: string,
        embedding: number[],
        content: string = 'test content',
    ): DocumentChunk {
        return {
            id,
            documentId,
            content,
            embedding,
            metadata: {
                source: 'test',
                date: new Date('2025-01-01'),
                documentType: 'technical_report',
            },
        };
    }

    it('청크를 삽입하고 개수를 확인한다', () => {
        const chunks = [
            createChunk('c1', 'doc1', [1, 0, 0]),
            createChunk('c2', 'doc1', [0, 1, 0]),
        ];

        store.insertChunks(chunks);
        expect(store.getChunkCount()).toBe(2);
    });

    it('문서 ID로 청크를 조회한다', () => {
        const chunks = [
            createChunk('c1', 'doc1', [1, 0, 0]),
            createChunk('c2', 'doc1', [0, 1, 0]),
            createChunk('c3', 'doc2', [0, 0, 1]),
        ];

        store.insertChunks(chunks);
        const doc1Chunks = store.getChunksByDocumentId('doc1');
        expect(doc1Chunks).toHaveLength(2);
        expect(doc1Chunks.map((c) => c.id)).toContain('c1');
        expect(doc1Chunks.map((c) => c.id)).toContain('c2');
    });

    it('코사인 유사도 기반 검색이 동작한다', () => {
        const chunks = [
            createChunk('c1', 'doc1', [1, 0, 0], '리튬 매장량'),
            createChunk('c2', 'doc1', [0, 1, 0], '중국 제련소'),
            createChunk('c3', 'doc1', [0.9, 0.1, 0], '리튬 생산량'),
        ];

        store.insertChunks(chunks);

        // [1, 0, 0]과 가장 유사한 벡터 검색
        const results = store.search([1, 0, 0], 2);
        expect(results).toHaveLength(2);
        // c1이 가장 유사해야 함 (완전 일치)
        expect(results[0].id).toBe('c1');
        // c3가 두 번째 (0.9에 가까움)
        expect(results[1].id).toBe('c3');
    });

    it('topK보다 적은 청크가 있으면 있는 만큼만 반환한다', () => {
        const chunks = [createChunk('c1', 'doc1', [1, 0, 0])];
        store.insertChunks(chunks);

        const results = store.search([1, 0, 0], 10);
        expect(results).toHaveLength(1);
    });

    it('빈 저장소에서 검색하면 빈 배열을 반환한다', () => {
        const results = store.search([1, 0, 0], 5);
        expect(results).toEqual([]);
    });

    it('청크를 노드와 연관시킨다', () => {
        const chunks = [
            createChunk('c1', 'doc1', [1, 0, 0]),
            createChunk('c2', 'doc1', [0, 1, 0]),
        ];
        store.insertChunks(chunks);

        store.associateWithNode(['c1', 'c2'], 'RF-01');

        const doc1Chunks = store.getChunksByDocumentId('doc1');
        for (const chunk of doc1Chunks) {
            expect(chunk.metadata.associatedNodeIds).toContain('RF-01');
        }
    });

    it('존재하지 않는 청크 ID에 대한 연관은 무시한다', () => {
        const chunks = [createChunk('c1', 'doc1', [1, 0, 0])];
        store.insertChunks(chunks);

        // 에러 없이 처리
        store.associateWithNode(['c1', 'nonexistent'], 'M-01');

        const doc1Chunks = store.getChunksByDocumentId('doc1');
        expect(doc1Chunks[0].metadata.associatedNodeIds).toContain('M-01');
    });

    it('동일 노드를 중복 연관시켜도 한 번만 저장된다', () => {
        const chunks = [createChunk('c1', 'doc1', [1, 0, 0])];
        store.insertChunks(chunks);

        store.associateWithNode(['c1'], 'RF-01');
        store.associateWithNode(['c1'], 'RF-01');

        const doc1Chunks = store.getChunksByDocumentId('doc1');
        const nodeIds = doc1Chunks[0].metadata.associatedNodeIds!;
        expect(nodeIds.filter((id) => id === 'RF-01')).toHaveLength(1);
    });
});
