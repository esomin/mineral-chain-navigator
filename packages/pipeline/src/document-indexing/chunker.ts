import type { ChunkingOptions } from '@navigator/shared';

/** 기본 청킹 설정 */
const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
    maxChunkSize: 1000,
    overlap: 200,
};

/**
 * 문서 본문을 의미 단위(문단)로 분할한 후 maxChunkSize에 맞게 청크를 생성한다.
 * 문단 경계를 우선으로 분할하며, 단일 문단이 maxChunkSize를 초과하면 문장 단위로 재분할한다.
 * 각 청크 사이에 overlap만큼의 문자가 중복된다.
 *
 * @param content - 문서 본문 텍스트
 * @param options - 청킹 옵션
 * @returns 청크 문자열 배열
 */
export function chunkDocument(content: string, options?: ChunkingOptions): string[] {
    const { maxChunkSize, overlap } = { ...DEFAULT_OPTIONS, ...options };

    if (!content || content.trim().length === 0) {
        return [];
    }

    // 문단 단위로 먼저 분리
    const paragraphs = content
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
        return [];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        // 단일 문단이 maxChunkSize를 초과하면 문장 단위로 분할
        if (paragraph.length > maxChunkSize) {
            // 현재 청크가 비어있지 않으면 먼저 저장
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            const sentences = splitIntoSentences(paragraph);
            let sentenceChunk = '';

            for (const sentence of sentences) {
                if (sentenceChunk.length + sentence.length + 1 > maxChunkSize) {
                    if (sentenceChunk.length > 0) {
                        chunks.push(sentenceChunk.trim());
                        // 오버랩 적용
                        sentenceChunk = getOverlapText(sentenceChunk, overlap);
                    }
                }
                sentenceChunk += (sentenceChunk.length > 0 ? ' ' : '') + sentence;
            }

            if (sentenceChunk.length > 0) {
                currentChunk = sentenceChunk;
            }
            continue;
        }

        // 현재 청크에 문단을 추가했을 때 maxChunkSize를 초과하면 저장
        const separator = currentChunk.length > 0 ? '\n\n' : '';
        if (currentChunk.length + separator.length + paragraph.length > maxChunkSize) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                // 오버랩 적용
                currentChunk = getOverlapText(currentChunk, overlap) + '\n\n' + paragraph;
            } else {
                currentChunk = paragraph;
            }
        } else {
            currentChunk += separator + paragraph;
        }
    }

    // 마지막 청크 저장
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * 텍스트를 문장 단위로 분리한다.
 */
function splitIntoSentences(text: string): string[] {
    // 한글/영어 문장 종결 부호 기준으로 분리
    const sentences = text.split(/(?<=[.!?。])\s+/).filter((s) => s.length > 0);
    return sentences.length > 0 ? sentences : [text];
}

/**
 * 텍스트 끝에서 overlap만큼의 문자를 추출한다.
 * 단어 경계에서 잘라낸다.
 */
function getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
        return text;
    }

    const tail = text.slice(-overlapSize);
    // 단어 경계에서 시작하도록 첫 번째 공백 이후부터 사용
    const firstSpace = tail.indexOf(' ');
    if (firstSpace > 0 && firstSpace < overlapSize / 2) {
        return tail.slice(firstSpace + 1);
    }
    return tail;
}
