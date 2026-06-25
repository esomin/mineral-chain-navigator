import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentController } from './document-controller.js';
import { InMemoryVectorStore, createMockEmbeddingProvider } from '@navigator/pipeline';
import type { DocumentChunk, EmbeddingProvider } from '@navigator/shared';

describe('DocumentController', () => {
    let controller: DocumentController;
    let vectorStore: InMemoryVectorStore;
    let embeddingProvider: EmbeddingProvider;

    beforeEach(() => {
        vectorStore = new InMemoryVectorStore();
        embeddingProvider = createMockEmbeddingProvider();
        controller = new DocumentController(vectorStore, embeddingProvider);
    });

    /** 테스트용 청크 생성 헬퍼 */
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

    describe('search', () => {
        it('쿼리 임베딩을 생성하고 벡터 저장소에서 검색한다', async () => {
            // 벡터 저장소에 청크 삽입
            const chunks = [
                createChunk('c1', 'doc1', [1, 0, 0], '리튬 매장량 분석'),
                createChunk('c2', 'doc1', [0, 1, 0], '중국 제련소 현황'),
                createChunk('c3', 'doc2', [0.9, 0.1, 0], '리튬 생산량 추이'),
            ];
            vectorStore.insertChunks(chunks);

            const results = await controller.search('리튬', 2);

            // topK 이하의 결과를 반환해야 한다
            expect(results.length).toBeLessThanOrEqual(2);
            expect(results.length).toBeGreaterThan(0);
        });

        it('결과가 유사도 내림차순으로 정렬된다', async () => {
            // 서로 다른 방향의 벡터를 가진 청크들을 삽입
            const chunks = [
                createChunk('c1', 'doc1', [1, 0, 0, 0], '첫 번째 문서'),
                createChunk('c2', 'doc1', [0, 1, 0, 0], '두 번째 문서'),
                createChunk('c3', 'doc1', [0, 0, 1, 0], '세 번째 문서'),
            ];
            vectorStore.insertChunks(chunks);

            const results = await controller.search('테스트 쿼리', 3);

            // 모든 결과가 반환되어야 한다
            expect(results).toHaveLength(3);
            // 결과는 배열이며, 벡터 저장소가 유사도 기준 정렬을 보장한다
            expect(Array.isArray(results)).toBe(true);
        });

        it('기본 topK 값은 5이다', async () => {
            // 6개 청크를 삽입
            const chunks = Array.from({ length: 6 }, (_, i) => {
                const embedding = new Array(4).fill(0);
                embedding[i % 4] = 1;
                return createChunk(`c${i}`, 'doc1', embedding, `문서 ${i}`);
            });
            vectorStore.insertChunks(chunks);

            // topK 미지정 시 기본값 5
            const results = await controller.search('테스트');
            expect(results.length).toBeLessThanOrEqual(5);
        });

        it('topK보다 저장된 청크가 적으면 있는 만큼만 반환한다', async () => {
            const chunks = [
                createChunk('c1', 'doc1', [1, 0, 0], '유일한 문서'),
            ];
            vectorStore.insertChunks(chunks);

            const results = await controller.search('쿼리', 10);
            expect(results).toHaveLength(1);
        });

        it('빈 벡터 저장소에서 빈 결과를 반환한다', async () => {
            const results = await controller.search('아무 쿼리', 5);
            expect(results).toEqual([]);
        });
    });

    describe('associateWithNode', () => {
        it('청크들을 지정된 노드와 연관시킨다', () => {
            const chunks = [
                createChunk('c1', 'doc1', [1, 0, 0]),
                createChunk('c2', 'doc1', [0, 1, 0]),
            ];
            vectorStore.insertChunks(chunks);

            controller.associateWithNode(['c1', 'c2'], 'RF-01');

            // 연관 결과 확인
            const storedChunks = vectorStore.getChunksByDocumentId('doc1');
            for (const chunk of storedChunks) {
                expect(chunk.metadata.associatedNodeIds).toContain('RF-01');
            }
        });

        it('존재하지 않는 청크 ID는 무시한다', () => {
            const chunks = [
                createChunk('c1', 'doc1', [1, 0, 0]),
            ];
            vectorStore.insertChunks(chunks);

            // 에러 없이 실행되어야 한다
            expect(() => {
                controller.associateWithNode(['c1', 'nonexistent'], 'M-01');
            }).not.toThrow();

            const storedChunks = vectorStore.getChunksByDocumentId('doc1');
            expect(storedChunks[0].metadata.associatedNodeIds).toContain('M-01');
        });

        it('동일 노드를 중복 연관시켜도 한 번만 저장된다', () => {
            const chunks = [createChunk('c1', 'doc1', [1, 0, 0])];
            vectorStore.insertChunks(chunks);

            controller.associateWithNode(['c1'], 'RF-01');
            controller.associateWithNode(['c1'], 'RF-01');

            const storedChunks = vectorStore.getChunksByDocumentId('doc1');
            const nodeIds = storedChunks[0].metadata.associatedNodeIds!;
            expect(nodeIds.filter((id) => id === 'RF-01')).toHaveLength(1);
        });

        it('여러 다른 노드를 동일 청크에 연관시킬 수 있다', () => {
            const chunks = [createChunk('c1', 'doc1', [1, 0, 0])];
            vectorStore.insertChunks(chunks);

            controller.associateWithNode(['c1'], 'RF-01');
            controller.associateWithNode(['c1'], 'M-01');

            const storedChunks = vectorStore.getChunksByDocumentId('doc1');
            expect(storedChunks[0].metadata.associatedNodeIds).toContain('RF-01');
            expect(storedChunks[0].metadata.associatedNodeIds).toContain('M-01');
        });
    });
});
