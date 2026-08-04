import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
    SupplyChainNode,
    SupplyChainEdge,
    SerializedNode,
    SerializedEdge,
    RawDataRecord,
    NormalizationResult,
} from '@navigator/shared';
import { deserializeNode, deserializeEdge } from '@navigator/shared';
import type { SeedDataResult, PipelineOutput } from '../types.js';

/**
 * 정규화 함수 타입.
 * 외부에서 주입 가능하도록 인터페이스를 분리한다.
 */
export type NormalizeFn = (raw: RawDataRecord) => NormalizationResult;

/**
 * 기본 정규화 함수. 유효성만 체크하고 항상 성공을 반환한다.
 * 실제 정규화 로직은 pipeline 패키지에서 주입한다.
 */
function defaultNormalize(raw: RawDataRecord): NormalizationResult {
    const errors: string[] = [];

    if (!raw.source || typeof raw.source !== 'string' || raw.source.trim() === '') {
        errors.push('source is required and must be a non-empty string');
    }
    if (!raw.recordType || typeof raw.recordType !== 'string' || raw.recordType.trim() === '') {
        errors.push('recordType is required and must be a non-empty string');
    }
    if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
        errors.push('data is required and must be a non-null object');
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return {
        success: true,
        record: {
            id: `${raw.source}-${raw.recordType}-${Date.now().toString(36)}`,
            source: raw.source.trim(),
            timestamp: new Date(),
            recordType: raw.recordType.trim(),
            data: { ...raw.data },
        },
    };
}

/**
 * 시드 데이터 기본 경로를 절대 경로로 변환한다.
 * packages/database/src/seed/ → packages/pipeline/data/
 */
function getSeedDataPath(relativePath: string): string {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    return resolve(currentDir, '..', '..', '..', 'pipeline', 'data', relativePath);
}

/**
 * JSON 파일을 읽고 파싱한다. 실패 시 null 반환.
 */
function readJsonFile<T>(filePath: string): T | null {
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch (error) {
        console.error(`[SeedData] Failed to read file: ${filePath}`, error);
        return null;
    }
}

/**
 * 직렬화된 노드를 정규화 파이프라인에 통과시킨 뒤
 * SupplyChainNode로 역직렬화한다.
 */
function processNode(
    serialized: SerializedNode,
    errors: string[],
    normalize: NormalizeFn,
): SupplyChainNode | null {
    const raw: RawDataRecord = {
        source: 'seed-data',
        recordType: 'node',
        data: serialized as unknown as Record<string, unknown>,
    };

    const result = normalize(raw);
    if (!result.success) {
        errors.push(`Node ${serialized.id}: ${result.errors.join(', ')}`);
        return null;
    }

    try {
        return deserializeNode(serialized);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Node ${serialized.id}: deserialization failed - ${msg}`);
        return null;
    }
}

/**
 * 직렬화된 엣지를 정규화 파이프라인에 통과시킨 뒤
 * SupplyChainEdge로 역직렬화한다.
 */
function processEdge(
    serialized: SerializedEdge,
    errors: string[],
    normalize: NormalizeFn,
): SupplyChainEdge | null {
    const raw: RawDataRecord = {
        source: 'seed-data',
        recordType: 'edge',
        data: serialized as unknown as Record<string, unknown>,
    };

    const result = normalize(raw);
    if (!result.success) {
        errors.push(`Edge ${serialized.id}: ${result.errors.join(', ')}`);
        return null;
    }

    try {
        return deserializeEdge(serialized);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Edge ${serialized.id}: deserialization failed - ${msg}`);
        return null;
    }
}

/**
 * SeedDataLoader 옵션.
 */
export interface LoadFromFilesOptions {
    /** 시드 데이터 기본 경로. 미지정 시 기본 경로 사용. */
    basePath?: string;
    /** 정규화 함수. 미지정 시 기본 정규화 사용. */
    normalize?: NormalizeFn;
}

/**
 * 파일 경로 기반으로 시드 데이터를 로딩한다.
 *
 * 파이프라인: JSON 파일 → 정규화 → 역직렬화 → SeedDataResult
 */
export function loadFromFiles(options?: LoadFromFilesOptions): SeedDataResult {
    const errors: string[] = [];
    const nodes: SupplyChainNode[] = [];
    const edges: SupplyChainEdge[] = [];

    const basePath = options?.basePath;
    const normalize = options?.normalize ?? defaultNormalize;

    const resolvePath = basePath
        ? (relativePath: string) => resolve(basePath, relativePath)
        : getSeedDataPath;

    // 노드 소스 파일 목록
    const nodeFiles = [
        'nodes.json',
    ];

    // 엣지 소스 파일 목록
    const edgeFiles = [
        'edges.json',
    ];

    // 노드 로딩 및 처리
    for (const file of nodeFiles) {
        const filePath = resolvePath(file);
        const serializedNodes = readJsonFile<SerializedNode[]>(filePath);

        if (!serializedNodes) {
            errors.push(`Failed to load node file: ${file}`);
            continue;
        }

        for (const serialized of serializedNodes) {
            const node = processNode(serialized, errors, normalize);
            if (node) {
                nodes.push(node);
            }
        }
    }

    // 엣지 로딩 및 처리
    for (const file of edgeFiles) {
        const filePath = resolvePath(file);
        const serializedEdges = readJsonFile<SerializedEdge[]>(filePath);

        if (!serializedEdges) {
            errors.push(`Failed to load edge file: ${file}`);
            continue;
        }

        for (const serialized of serializedEdges) {
            const edge = processEdge(serialized, errors, normalize);
            if (edge) {
                edges.push(edge);
            }
        }
    }

    // 결과 요약 로깅
    if (errors.length > 0) {
        console.warn(`[SeedData] Loaded with ${errors.length} error(s):`, errors);
    }
    console.info(
        `[SeedData] Successfully loaded ${nodes.length} nodes and ${edges.length} edges`,
    );

    return { nodes, edges, errors };
}

/**
 * 파이프라인 출력 기반으로 시드 데이터를 로딩한다.
 * pipeline 패키지에서 이미 정규화된 데이터를 직접 받아 SeedDataResult로 변환한다.
 */
export function loadFromPipeline(pipelineOutput: PipelineOutput): SeedDataResult {
    return {
        nodes: [...pipelineOutput.nodes],
        edges: [...pipelineOutput.edges],
        errors: [],
    };
}

/**
 * 기존 loadSeedData 호환 함수.
 * 기존 packages/backend/src/ingestion/load-seed-data.ts와 동일한 인터페이스를 유지한다.
 */
export function loadSeedData(seedDataBasePath?: string): SeedDataResult {
    return loadFromFiles({ basePath: seedDataBasePath });
}
