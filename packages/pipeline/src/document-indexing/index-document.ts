import type {
    RawDocument,
    IndexResult,
    DocumentChunk,
    ChunkMetadata,
    ChunkingOptions,
    EmbeddingProvider,
    VectorStore,
    DocumentType,
} from '@navigator/shared';
import { chunkDocument } from './chunker.js';

/** 유효한 문서 유형 집합 */
const VALID_DOCUMENT_TYPES: Set<string> = new Set([
    'policy',
    'technical_report',
    'regulation',
    'news',
]);

/**
 * 문서 ID를 생성한다.
 */
function generateDocumentId(source: string, title: string): string {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    const sanitized = title.replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 30);
    return `doc_${sanitized}_${timestamp}_${rand}`;
}

/**
 * 청크 ID를 생성한다.
 */
function generateChunkId(documentId: string, index: number): string {
    return `${documentId}_chunk_${index.toString().padStart(4, '0')}`;
}

/**
 * 원시 문서 입력의 유효성을 검증한다.
 */
function validateRawDocument(doc: RawDocument): string[] {
    const errors: string[] = [];

    if (!doc.title || typeof doc.title !== 'string' || doc.title.trim().length === 0) {
        errors.push('title은 필수이며 비어있지 않은 문자열이어야 합니다.');
    }

    if (!doc.content || typeof doc.content !== 'string' || doc.content.trim().length === 0) {
        errors.push('content는 필수이며 비어있지 않은 문자열이어야 합니다.');
    }

    if (!doc.source || typeof doc.source !== 'string' || doc.source.trim().length === 0) {
        errors.push('source는 필수이며 비어있지 않은 문자열이어야 합니다.');
    }

    if (!doc.date) {
        errors.push('date는 필수입니다.');
    } else {
        const dateObj = doc.date instanceof Date ? doc.date : new Date(doc.date);
        if (isNaN(dateObj.getTime())) {
            errors.push('date는 유효한 날짜여야 합니다.');
        }
    }

    if (!doc.documentType || !VALID_DOCUMENT_TYPES.has(doc.documentType)) {
        errors.push(
            `documentType은 다음 중 하나여야 합니다: ${Array.from(VALID_DOCUMENT_TYPES).join(', ')}`,
        );
    }

    return errors;
}

/**
 * 문서 인덱싱 파이프라인.
 *
 * 1. 입력 문서의 유효성을 검증한다.
 * 2. 문서를 청크 단위로 분할한다.
 * 3. 각 청크에 대해 벡터 임베딩을 생성한다.
 * 4. 메타데이터(source, date, document_type)를 포함하여 벡터 저장소에 저장한다.
 * 5. 파싱 실패 시 에러를 로깅하고 건너뛴다.
 *
 * Requirements: 8.1, 8.4
 *
 * @param doc - 인덱싱할 원시 문서
 * @param vectorStore - 벡터 저장소
 * @param embeddingProvider - 임베딩 생성 함수
 * @param options - 청킹 옵션
 * @returns 인덱싱 결과
 */
export async function indexDocument(
    doc: RawDocument,
    vectorStore: VectorStore,
    embeddingProvider: EmbeddingProvider,
    options?: ChunkingOptions,
): Promise<IndexResult> {
    // 1. 유효성 검증
    const validationErrors = validateRawDocument(doc);
    if (validationErrors.length > 0) {
        console.error(
            `[DocumentIndexing] 문서 유효성 검증 실패 (source: "${doc?.source ?? 'unknown'}"):`,
            validationErrors,
        );
        return {
            success: false,
            documentId: '',
            chunksIndexed: 0,
            errors: validationErrors,
        };
    }

    const documentId = generateDocumentId(doc.source, doc.title);
    const dateObj = doc.date instanceof Date ? doc.date : new Date(doc.date as string);
    const errors: string[] = [];

    // 2. 문서 청킹
    let textChunks: string[];
    try {
        textChunks = chunkDocument(doc.content, options);
    } catch (err) {
        const errorMsg = `문서 청킹 실패: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[DocumentIndexing] ${errorMsg}`);
        return {
            success: false,
            documentId,
            chunksIndexed: 0,
            errors: [errorMsg],
        };
    }

    if (textChunks.length === 0) {
        const errorMsg = '문서 내용이 비어있어 청크를 생성할 수 없습니다.';
        console.error(`[DocumentIndexing] ${errorMsg}`);
        return {
            success: false,
            documentId,
            chunksIndexed: 0,
            errors: [errorMsg],
        };
    }

    // 3. 각 청크에 대해 임베딩 생성 및 DocumentChunk 구성
    const documentChunks: DocumentChunk[] = [];

    for (let i = 0; i < textChunks.length; i++) {
        const chunkContent = textChunks[i];
        const chunkId = generateChunkId(documentId, i);

        try {
            const embedding = await embeddingProvider(chunkContent);

            const metadata: ChunkMetadata = {
                source: doc.source.trim(),
                date: dateObj,
                documentType: doc.documentType as DocumentType,
                pageNumber: i + 1,
            };

            const documentChunk: DocumentChunk = {
                id: chunkId,
                documentId,
                content: chunkContent,
                embedding,
                metadata,
            };

            documentChunks.push(documentChunk);
        } catch (err) {
            // 임베딩 생성 실패 시 해당 청크 건너뛰기 (Requirements 8.4)
            const errorMsg = `청크 ${i} 임베딩 생성 실패: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[DocumentIndexing] ${errorMsg}`);
            errors.push(errorMsg);
            // 다음 청크 계속 처리
        }
    }

    // 4. 벡터 저장소에 저장
    if (documentChunks.length > 0) {
        try {
            vectorStore.insertChunks(documentChunks);
        } catch (err) {
            const errorMsg = `벡터 저장소 삽입 실패: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[DocumentIndexing] ${errorMsg}`);
            return {
                success: false,
                documentId,
                chunksIndexed: 0,
                errors: [...errors, errorMsg],
            };
        }
    }

    const success = documentChunks.length > 0;
    if (!success) {
        console.error(
            `[DocumentIndexing] 모든 청크의 임베딩 생성에 실패했습니다. (document: ${documentId})`,
        );
    }

    return {
        success,
        documentId,
        chunksIndexed: documentChunks.length,
        errors,
    };
}
