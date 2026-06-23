import type { EmbeddingProvider } from '@navigator/shared';

/**
 * OpenAI text-embedding-3-small 기반 임베딩 생성 제공자.
 * 환경 변수 OPENAI_API_KEY가 설정되어 있어야 한다.
 *
 * @param apiKey - OpenAI API 키
 * @returns 임베딩 생성 함수
 */
export function createOpenAIEmbeddingProvider(apiKey: string): EmbeddingProvider {
    return async (text: string): Promise<number[]> => {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: text,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `OpenAI 임베딩 API 호출 실패 (${response.status}): ${errorBody}`,
            );
        }

        const data = (await response.json()) as {
            data: Array<{ embedding: number[] }>;
        };

        return data.data[0].embedding;
    };
}

/**
 * 테스트 및 개발용 모의(mock) 임베딩 제공자.
 * 텍스트의 해시를 기반으로 결정적인 1536차원 벡터를 생성한다.
 *
 * @returns 모의 임베딩 생성 함수
 */
export function createMockEmbeddingProvider(): EmbeddingProvider {
    return async (text: string): Promise<number[]> => {
        // 텍스트 해시 기반 결정적 벡터 생성
        const embedding = new Array(1536).fill(0);
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const idx = (charCode * (i + 1)) % 1536;
            embedding[idx] = (embedding[idx] + charCode / 255) % 1;
        }

        // L2 정규화
        const magnitude = Math.sqrt(
            embedding.reduce((sum: number, val: number) => sum + val * val, 0),
        );
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }

        return embedding;
    };
}
