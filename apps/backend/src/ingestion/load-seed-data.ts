import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
    SupplyChainNode,
    SupplyChainEdge,
    SerializedNode,
    SerializedEdge,
    RawDataRecord,
} from '@navigator/shared';
import { deserializeNode, deserializeEdge } from '@navigator/shared';
import { normalizeRecord } from '@navigator/pipeline';

/**
 * 시드 데이터 로딩 결과를 담는 인터페이스.
 */
export interface SeedDataResult {
    nodes: SupplyChainNode[];
    edges: SupplyChainEdge[];
    errors: string[];
}

/**
 * pipeline/data 경로를 기준으로 상대 경로를 절대 경로로 변환한다.
 */
function getSeedDataPath(relativePath: string): string {
    // apps/backend/src/ingestion/ → packages/pipeline/data/ 경로 탐색
    const currentDir = dirname(fileURLToPath(import.meta.url));
    return resolve(currentDir, '..', '..', '..', '..', 'packages', 'pipeline', 'data', relativePath);
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
function processNode(serialized: SerializedNode, errors: string[]): SupplyChainNode | null {
    const raw: RawDataRecord = {
        source: 'seed-data',
        recordType: 'node',
        data: serialized as unknown as Record<string, unknown>,
    };

    const result = normalizeRecord(raw);
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
function processEdge(serialized: SerializedEdge, errors: string[]): SupplyChainEdge | null {
    const raw: RawDataRecord = {
        source: 'seed-data',
        recordType: 'edge',
        data: serialized as unknown as Record<string, unknown>,
    };

    const result = normalizeRecord(raw);
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
 * 모든 시드 데이터 JSON 파일을 로딩하고, 정규화한 뒤
 * 공급망 그래프를 구축한다.
 *
 * 파이프라인: JSON 파일 → 정규화 → 역직렬화 → 그래프
 *
 * 거래데이터 -> 거래량/속성 edge
 * 가격데이터 -> 자원/정제소 node
 */
export function loadSeedData(seedDataBasePath?: string): SeedDataResult {
    const errors: string[] = [];
    const nodes: SupplyChainNode[] = [];
    const edges: SupplyChainEdge[] = [];

    const resolvePath = seedDataBasePath
        ? (relativePath: string) => resolve(seedDataBasePath, relativePath)
        : getSeedDataPath;

    // 노드 소스 파일 목록
    const nodeFiles = [
        'nodes/resource.json',
        'nodes/mines.json',
        'nodes/refineries.json',
        'nodes/factories.json',
    ];

    // 엣지 소스 파일 목록
    const edgeFiles = [
        'edges/supply-chains.json',
        'edges/trade-flows.json',
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
            const node = processNode(serialized, errors);
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
            const edge = processEdge(serialized, errors);
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
