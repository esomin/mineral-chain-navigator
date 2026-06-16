import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupplyChainNode, RawDataRecord } from '@mineral-chain/shared';
import { normalizeRecord } from './normalize.js';

/**
 * 가격 데이터 JSON 파일의 개별 가격 항목.
 */
export interface PriceEntry {
    date: string;   // "YYYY-MM" 또는 "YYYYMM" 형식
    value: number;
}

/**
 * 가격 데이터 JSON 파일 구조.
 */
export interface PriceDataFile {
    source: string;
    product: string;
    unit: string;
    hsCode?: string;
    spec?: string;
    incoterms?: string;
    prices: PriceEntry[];
    latestPrice?: PriceEntry;
    [key: string]: unknown;
}

/**
 * 가격 데이터 로딩 결과.
 */
export interface PriceLoadResult {
    updatedNodes: string[];
    errors: string[];
}

/** Resource 노드 ID */
const RESOURCE_NODE_ID = 'R-01';

/** Refinery 노드 ID 목록 */
const REFINERY_NODE_IDS = ['RF-01', 'RF-02', 'RF-03', 'RF-04', 'RF-05'];

/** 가격 데이터를 연결할 대상 노드 ID 목록 */
const TARGET_NODE_IDS = [RESOURCE_NODE_ID, ...REFINERY_NODE_IDS];

/**
 * seed-data 패키지 기준 상대 경로를 절대 경로로 변환한다.
 */
function getSeedDataPath(relativePath: string): string {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    return resolve(currentDir, '..', '..', '..', 'seed-data', relativePath);
}

/**
 * JSON 파일을 읽고 파싱한다. 실패 시 null 반환.
 */
function readJsonFile<T>(filePath: string): T | null {
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch (error) {
        console.error(`[PriceData] Failed to read file: ${filePath}`, error);
        return null;
    }
}

/**
 * 날짜 문자열을 정규화하여 비교 가능한 형태("YYYY-MM")로 변환한다.
 * - "YYYY-MM" → 그대로 반환
 * - "YYYYMM" → "YYYY-MM" 으로 변환
 */
function normalizeDateString(date: string): string {
    if (date.length === 6 && !date.includes('-')) {
        // "YYYYMM" → "YYYY-MM"
        return `${date.slice(0, 4)}-${date.slice(4, 6)}`;
    }
    return date;
}

/**
 * 가격 배열에서 가장 최근 날짜의 가격을 선택한다.
 * latestPrice 필드가 있으면 해당 값을 우선 사용하되,
 * prices 배열에서 더 최근 값이 있으면 그것을 사용한다.
 */
export function selectLatestPrice(priceData: PriceDataFile): PriceEntry | null {
    const allPrices: PriceEntry[] = [...priceData.prices];

    if (allPrices.length === 0) {
        return priceData.latestPrice ?? null;
    }

    // latestPrice가 있으면 prices 배열에 포함시켜 비교
    if (priceData.latestPrice) {
        allPrices.push(priceData.latestPrice);
    }

    // 정규화된 날짜 기준으로 가장 최근 항목 선택
    let latest = allPrices[0];
    let latestNormalized = normalizeDateString(latest.date);

    for (let i = 1; i < allPrices.length; i++) {
        const normalized = normalizeDateString(allPrices[i].date);
        if (normalized > latestNormalized) {
            latest = allPrices[i];
            latestNormalized = normalized;
        }
    }

    return latest;
}

/**
 * 가격 데이터를 로딩하여 Resource 및 Refinery 노드에 연결한다.
 *
 * 파이프라인: JSON 파일 → 정규화 → 최신 가격 선택 → 노드 메타데이터 업데이트
 *
 * Requirements: 2.3
 *
 * @param nodes - 업데이트할 SupplyChainNode 배열
 * @param seedDataBasePath - seed-data 기본 경로 (테스트용 오버라이드)
 * @returns 업데이트된 노드 배열과 결과 정보
 */
export function loadPriceData(
    nodes: SupplyChainNode[],
    seedDataBasePath?: string,
): { nodes: SupplyChainNode[]; result: PriceLoadResult } {
    const errors: string[] = [];
    const updatedNodes: string[] = [];

    const resolvePath = seedDataBasePath
        ? (relativePath: string) => resolve(seedDataBasePath, relativePath)
        : getSeedDataPath;

    // 가격 데이터 파일 목록
    const priceFiles = [
        'prices/lithium-prices.json',
        'komis-price.json',
    ];

    // 모든 가격 파일에서 데이터를 수집
    let selectedPrice: PriceEntry | null = null;
    let priceSource = '';
    let priceUnit = '';

    for (const file of priceFiles) {
        const filePath = resolvePath(file);
        const priceData = readJsonFile<PriceDataFile>(filePath);

        if (!priceData) {
            errors.push(`Failed to load price file: ${file}`);
            continue;
        }

        // 정규화 파이프라인 통과
        const raw: RawDataRecord = {
            source: priceData.source,
            recordType: 'price',
            data: priceData as unknown as Record<string, unknown>,
        };

        const normResult = normalizeRecord(raw);
        if (!normResult.success) {
            errors.push(`Price file ${file}: normalization failed - ${normResult.errors.join(', ')}`);
            continue;
        }

        // 최신 가격 선택
        const latestFromFile = selectLatestPrice(priceData);
        if (!latestFromFile) {
            errors.push(`Price file ${file}: no price entries found`);
            continue;
        }

        // 모든 파일 중 가장 최근 가격 선택
        if (!selectedPrice) {
            selectedPrice = latestFromFile;
            priceSource = priceData.source;
            priceUnit = priceData.unit;
        } else {
            const currentNormalized = normalizeDateString(selectedPrice.date);
            const newNormalized = normalizeDateString(latestFromFile.date);
            if (newNormalized > currentNormalized) {
                selectedPrice = latestFromFile;
                priceSource = priceData.source;
                priceUnit = priceData.unit;
            }
        }
    }

    if (!selectedPrice) {
        errors.push('No valid price data found from any source');
        return { nodes, result: { updatedNodes, errors } };
    }

    // 대상 노드에 가격 데이터 연결
    const updatedNodeList = nodes.map((node) => {
        if (TARGET_NODE_IDS.includes(node.id)) {
            updatedNodes.push(node.id);
            return {
                ...node,
                metadata: {
                    ...node.metadata,
                    currentPrice: selectedPrice!.value,
                    priceUnit,
                    priceDate: normalizeDateString(selectedPrice!.date),
                    priceSource,
                },
                updatedAt: new Date(),
            };
        }
        return node;
    });

    // 결과 요약 로깅
    if (errors.length > 0) {
        console.warn(`[PriceData] Loaded with ${errors.length} error(s):`, errors);
    }
    console.info(
        `[PriceData] Updated ${updatedNodes.length} nodes with price ${selectedPrice.value} ${priceUnit} (${normalizeDateString(selectedPrice.date)})`,
    );

    return { nodes: updatedNodeList, result: { updatedNodes, errors } };
}
