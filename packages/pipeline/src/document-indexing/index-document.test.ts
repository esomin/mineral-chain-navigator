import { describe, it, expect, vi, beforeEach } from 'vitest';
import { indexDocument } from './index-document.js';
import { InMemoryVectorStore } from './vector-store.js';
import { createMockEmbeddingProvider } from './embedding.js';
import type { RawDocument, EmbeddingProvider } from '@navigator/shared';

describe('indexDocument', () => {
    let vectorStore: InMemoryVectorStore;
    let embeddingProvider: EmbeddingProvider;

    beforeEach(() => {
        vectorStore = new InMemoryVectorStore();
        embeddingProvider = createMockEmbeddingProvider();
    });

    const validDoc: RawDocument = {
        title: '리튬 공급망 분석 보고서 2025',
        content:
            '칠레의 아타카마 염호는 세계 최대의 리튬 매장지입니다.\n\n' +
            '중국은 전 세계 리튬 정제 능력의 60% 이상을 차지합니다.\n\n' +
            '한국의 POSCO는 광양에 수산화리튬 제련소를 운영합니다.',
        source: 'USGS',
        date: '2025-01-15',
        documentType: 'technical_report',
    };

    it('유효한 문서를 성공적으로 인덱싱한다', async () => {
        const result = await indexDocument(validDoc, vectorStore, embeddingProvider);

        expect(result.success).toBe(true);
        expect(result.documentId).toBeTruthy();
        expect(result.chunksIndexed).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(0);
        expect(vectorStore.getChunkCount()).toBe(result.chunksIndexed);
    });

    it('인덱싱된 청크에 메타데이터가 포함된다 (source, date, documentType)', async () => {
        const result = await indexDocument(validDoc, vectorStore, embeddingProvider);
        const chunks = vectorStore.getChunksByDocumentId(result.documentId);

        expect(chunks.length).toBeGreaterThan(0);
        for (const chunk of chunks) {
            expect(chunk.metadata.source).toBe('USGS');
            expect(chunk.metadata.date).toEqual(new Date('2025-01-15'));
            expect(chunk.metadata.documentType).toBe('technical_report');
        }
    });

    it('title이 비어있으면 인덱싱에 실패한다', async () => {
        const invalidDoc = { ...validDoc, title: '' };
        const result = await indexDocument(invalidDoc, vectorStore, embeddingProvider);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(vectorStore.getChunkCount()).toBe(0);
    });

    it('content가 비어있으면 인덱싱에 실패한다', async () => {
        const invalidDoc = { ...validDoc, content: '' };
        const result = await indexDocument(invalidDoc, vectorStore, embeddingProvider);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(vectorStore.getChunkCount()).toBe(0);
    });

    it('source가 비어있으면 인덱싱에 실패한다', async () => {
        const invalidDoc = { ...validDoc, source: '' };
        const result = await indexDocument(invalidDoc, vectorStore, embeddingProvider);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('잘못된 documentType이면 인덱싱에 실패한다', async () => {
        const invalidDoc = { ...validDoc, documentType: 'invalid' as any };
        const result = await indexDocument(invalidDoc, vectorStore, embeddingProvider);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('유효하지 않은 date이면 인덱싱에 실패한다', async () => {
        const invalidDoc = { ...validDoc, date: 'not-a-date' };
        const result = await indexDocument(invalidDoc, vectorStore, embeddingProvider);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('임베딩 생성 실패 시 해당 청크를 건너뛰고 에러를 기록한다', async () => {
        let callCount = 0;
        const failingProvider: EmbeddingProvider = async (_text: string) => {
            callCount++;
            if (callCount === 1) {
                throw new Error('API 호출 실패');
            }
            return new Array(1536).fill(0.1);
        };

        const result = await indexDocument(validDoc, vectorStore, failingProvider);

        // 일부 청크는 성공해야 함
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('임베딩 생성 실패');
    });

    it('모든 임베딩 생성이 실패하면 success가 false이다', async () => {
        const alwaysFailProvider: EmbeddingProvider = async () => {
            throw new Error('서비스 불가');
        };

        const result = await indexDocument(validDoc, vectorStore, alwaysFailProvider);

        expect(result.success).toBe(false);
        expect(result.chunksIndexed).toBe(0);
    });

    it('Date 객체로 date를 전달해도 정상 처리된다', async () => {
        const docWithDateObj = { ...validDoc, date: new Date('2025-03-01') };
        const result = await indexDocument(docWithDateObj, vectorStore, embeddingProvider);

        expect(result.success).toBe(true);
        const chunks = vectorStore.getChunksByDocumentId(result.documentId);
        expect(chunks[0].metadata.date).toEqual(new Date('2025-03-01'));
    });

    it('커스텀 청킹 옵션을 적용할 수 있다', async () => {
        const longContent = 'A'.repeat(500) + '\n\n' + 'B'.repeat(500) + '\n\n' + 'C'.repeat(500);
        const doc = { ...validDoc, content: longContent };

        const smallChunks = await indexDocument(doc, vectorStore, embeddingProvider, {
            maxChunkSize: 300,
            overlap: 50,
        });

        expect(smallChunks.chunksIndexed).toBeGreaterThan(1);
    });

    it('파싱 실패 시 기존 데이터에 영향을 주지 않는다 (Requirements 8.4)', async () => {
        // 먼저 유효한 문서를 인덱싱
        await indexDocument(validDoc, vectorStore, embeddingProvider);
        const countBefore = vectorStore.getChunkCount();

        // 잘못된 문서 시도
        const invalidDoc = { ...validDoc, title: '', content: '' };
        await indexDocument(invalidDoc, vectorStore, embeddingProvider);

        // 기존 데이터 보존 확인
        expect(vectorStore.getChunkCount()).toBe(countBefore);
    });
});
