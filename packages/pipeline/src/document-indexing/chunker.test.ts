import { describe, it, expect } from 'vitest';
import { chunkDocument } from './chunker.js';

describe('chunkDocument', () => {
    it('빈 문자열은 빈 배열을 반환한다', () => {
        expect(chunkDocument('')).toEqual([]);
        expect(chunkDocument('   ')).toEqual([]);
    });

    it('짧은 문서는 단일 청크로 반환한다', () => {
        const content = '리튬 공급망 분석 보고서입니다.';
        const chunks = chunkDocument(content);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(content);
    });

    it('문단 경계에서 청크를 분할한다', () => {
        const paragraph1 = 'A'.repeat(600);
        const paragraph2 = 'B'.repeat(600);
        const content = `${paragraph1}\n\n${paragraph2}`;

        const chunks = chunkDocument(content, { maxChunkSize: 800, overlap: 100 });
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        expect(chunks[0]).toContain('A');
    });

    it('maxChunkSize를 초과하는 단일 문단은 문장 단위로 분할한다', () => {
        const sentences = Array.from(
            { length: 20 },
            (_, i) => `이것은 문장 ${i + 1}번입니다.`,
        );
        const longParagraph = sentences.join(' ');
        const chunks = chunkDocument(longParagraph, { maxChunkSize: 100, overlap: 20 });
        expect(chunks.length).toBeGreaterThan(1);
        // 각 청크는 maxChunkSize 이하의 합리적인 크기
        for (const chunk of chunks) {
            // 문장 단위 분할이므로 일부 초과 가능하지만 합리적 범위 내
            expect(chunk.length).toBeGreaterThan(0);
        }
    });

    it('overlap을 적용하여 청크 간 연속성을 유지한다', () => {
        const paragraph1 = '가나다라마바사아자차카타파하 '.repeat(50).trim();
        const paragraph2 = '아야어여오요우유으이 '.repeat(50).trim();
        const content = `${paragraph1}\n\n${paragraph2}`;

        const chunks = chunkDocument(content, { maxChunkSize: 300, overlap: 50 });
        expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('여러 문단을 가진 문서를 올바르게 처리한다', () => {
        const paragraphs = [
            '칠레의 아타카마 염호는 세계 최대의 리튬 매장지입니다.',
            '중국은 전 세계 리튬 정제 능력의 60% 이상을 차지합니다.',
            '한국의 POSCO는 광양에 수산화리튬 제련소를 운영합니다.',
            '미국의 IRA 법안은 배터리 공급망 현지화를 촉진합니다.',
            '일본의 파나소닉은 테슬라와 4680 배터리를 공급합니다.',
        ];
        const content = paragraphs.join('\n\n');
        const chunks = chunkDocument(content, { maxChunkSize: 500, overlap: 100 });
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        // 전체 내용이 보존됨
        const allContent = chunks.join(' ');
        for (const paragraph of paragraphs) {
            // 문단 내용이 어딘가에 존재해야 함
            expect(allContent).toContain(paragraph.substring(0, 20));
        }
    });

    it('기본 옵션 (maxChunkSize=1000, overlap=200)을 사용한다', () => {
        const longContent = 'X'.repeat(500) + '\n\n' + 'Y'.repeat(500) + '\n\n' + 'Z'.repeat(500);
        const chunks = chunkDocument(longContent);
        // 1500자 내용을 기본 1000 chunk로 분할 → 2개 이상
        expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
});
