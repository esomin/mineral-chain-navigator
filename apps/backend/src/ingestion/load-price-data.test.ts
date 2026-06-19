import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPriceData, selectLatestPrice } from './load-price-data.js';
import type { PriceDataFile } from './load-price-data.js';
import type { SupplyChainNode } from '@mineral-chain/shared';

/** 테스트용 임시 디렉토리 경로 */
let testSeedDir: string;

/** 테스트용 SupplyChainNode 생성 헬퍼 */
function makeNode(id: string, type: 'Resource' | 'Refinery' | 'Factory' | 'Mine' = 'Resource'): SupplyChainNode {
    return {
        id,
        type,
        name: `Test Node ${id}`,
        country: 'SouthKorea',
        coordinates: { latitude: 37.5, longitude: 127.0 },
        metadata: {
            productionCapacity: 1000,
            capacityUnit: 'tons_lce',
        },
        description: `Test node ${id}`,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

/** lithium-prices.json 형식의 테스트 데이터 */
function makeLithiumPriceData(overrides: Partial<PriceDataFile> = {}): PriceDataFile {
    return {
        source: 'KOMIS',
        product: 'LiOH',
        unit: 'USD/kg',
        hsCode: '282520',
        prices: [
            { date: '2025-07', value: 7.80 },
            { date: '2025-08', value: 8.65 },
            { date: '2025-12', value: 11.45 },
            { date: '2026-06', value: 21.18 },
        ],
        latestPrice: { date: '2026-06', value: 21.18 },
        ...overrides,
    };
}

/** komis-price.json 형식의 테스트 데이터 (YYYYMM 형식) */
function makeKomisPriceData(overrides: Partial<PriceDataFile> = {}): PriceDataFile {
    return {
        source: 'Mining Database',
        product: 'LiOH',
        unit: 'USD/kg',
        prices: [
            { date: '202606', value: 21.18 },
            { date: '202605', value: 22.11 },
            { date: '202507', value: 7.80 },
        ],
        ...overrides,
    };
}

beforeEach(() => {
    testSeedDir = resolve(tmpdir(), `backend-price-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(resolve(testSeedDir, 'prices'), { recursive: true });
});

afterEach(() => {
    rmSync(testSeedDir, { recursive: true, force: true });
});

/** 테스트용 가격 파일 작성 헬퍼 */
function writePriceFile(relativePath: string, data: PriceDataFile): void {
    const filePath = resolve(testSeedDir, relativePath);
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

describe('selectLatestPrice', () => {
    it('should select the most recently dated price from YYYY-MM format', () => {
        const data = makeLithiumPriceData();
        const result = selectLatestPrice(data);

        expect(result).not.toBeNull();
        expect(result!.date).toBe('2026-06');
        expect(result!.value).toBe(21.18);
    });

    it('should select the most recently dated price from YYYYMM format', () => {
        const data = makeKomisPriceData();
        const result = selectLatestPrice(data);

        expect(result).not.toBeNull();
        expect(result!.value).toBe(21.18);
    });

    it('should return latestPrice when prices array is empty', () => {
        const data = makeLithiumPriceData({
            prices: [],
            latestPrice: { date: '2026-06', value: 21.18 },
        });
        const result = selectLatestPrice(data);

        expect(result).not.toBeNull();
        expect(result!.value).toBe(21.18);
    });

    it('should return null when no prices and no latestPrice', () => {
        const data: PriceDataFile = {
            source: 'Test',
            product: 'LiOH',
            unit: 'USD/kg',
            prices: [],
        };
        const result = selectLatestPrice(data);

        expect(result).toBeNull();
    });

    it('should choose latestPrice over prices array if it is more recent', () => {
        const data = makeLithiumPriceData({
            prices: [{ date: '2025-01', value: 5.0 }],
            latestPrice: { date: '2026-12', value: 30.0 },
        });
        const result = selectLatestPrice(data);

        expect(result!.date).toBe('2026-12');
        expect(result!.value).toBe(30.0);
    });

    it('should choose prices array entry if it is more recent than latestPrice', () => {
        const data = makeLithiumPriceData({
            prices: [{ date: '2027-01', value: 50.0 }],
            latestPrice: { date: '2026-06', value: 21.18 },
        });
        const result = selectLatestPrice(data);

        expect(result!.date).toBe('2027-01');
        expect(result!.value).toBe(50.0);
    });
});

describe('loadPriceData', () => {
    describe('price data loading', () => {
        it('should load price data from lithium-prices.json format', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData());
            writePriceFile('komis-price.json', makeKomisPriceData());

            const nodes = [makeNode('R-01'), makeNode('RF-01', 'Refinery')];
            const { result } = loadPriceData(nodes, testSeedDir);

            expect(result.errors).toHaveLength(0);
            expect(result.updatedNodes).toContain('R-01');
            expect(result.updatedNodes).toContain('RF-01');
        });

        it('should load price data from komis-price.json YYYYMM format', () => {
            // Only provide komis-price.json
            writePriceFile('komis-price.json', makeKomisPriceData());
            // lithium-prices.json missing → will produce an error but komis still loads

            const nodes = [makeNode('R-01')];
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const { nodes: updatedNodes, result } = loadPriceData(nodes, testSeedDir);
            consoleSpy.mockRestore();

            // Should still update from komis-price.json
            expect(result.updatedNodes).toContain('R-01');
            expect(updatedNodes[0].metadata.currentPrice).toBeDefined();
        });
    });

    describe('most recent price selection', () => {
        it('should select the most recently dated price value', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData());
            writePriceFile('komis-price.json', makeKomisPriceData());

            const nodes = [makeNode('R-01')];
            const { nodes: updatedNodes } = loadPriceData(nodes, testSeedDir);

            // 2026-06 is the most recent from both files (same date, same value)
            expect(updatedNodes[0].metadata.currentPrice).toBe(21.18);
            expect(updatedNodes[0].metadata.priceDate).toBe('2026-06');
        });

        it('should pick the file with the more recent date when files differ', () => {
            // lithium-prices has older data
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData({
                prices: [{ date: '2025-01', value: 5.0 }],
                latestPrice: { date: '2025-01', value: 5.0 },
            }));
            // komis has newer data
            writePriceFile('komis-price.json', makeKomisPriceData({
                prices: [{ date: '202701', value: 99.0 }],
            }));

            const nodes = [makeNode('R-01')];
            const { nodes: updatedNodes } = loadPriceData(nodes, testSeedDir);

            expect(updatedNodes[0].metadata.currentPrice).toBe(99.0);
            expect(updatedNodes[0].metadata.priceDate).toBe('2027-01');
            expect(updatedNodes[0].metadata.priceSource).toBe('Mining Database');
        });
    });

    describe('node price association', () => {
        it('should update Resource node R-01 with price data', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData());
            writePriceFile('komis-price.json', makeKomisPriceData());

            const nodes = [makeNode('R-01')];
            const { nodes: updatedNodes } = loadPriceData(nodes, testSeedDir);

            expect(updatedNodes[0].metadata.currentPrice).toBe(21.18);
            expect(updatedNodes[0].metadata.priceUnit).toBe('USD/kg');
            expect(updatedNodes[0].metadata.priceDate).toBe('2026-06');
            expect(updatedNodes[0].metadata.priceSource).toBeDefined();
        });

        it('should update all Refinery nodes RF-01 through RF-05', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData());
            writePriceFile('komis-price.json', makeKomisPriceData());

            const nodes = [
                makeNode('RF-01', 'Refinery'),
                makeNode('RF-02', 'Refinery'),
                makeNode('RF-03', 'Refinery'),
                makeNode('RF-04', 'Refinery'),
                makeNode('RF-05', 'Refinery'),
            ];
            const { nodes: updatedNodes, result } = loadPriceData(nodes, testSeedDir);

            expect(result.updatedNodes).toHaveLength(5);
            for (const node of updatedNodes) {
                expect(node.metadata.currentPrice).toBe(21.18);
                expect(node.metadata.priceUnit).toBe('USD/kg');
            }
        });

        it('should not update nodes that are not Resource or Refinery', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData());
            writePriceFile('komis-price.json', makeKomisPriceData());

            const nodes = [makeNode('F-01', 'Factory'), makeNode('M-01', 'Mine')];
            const { nodes: updatedNodes, result } = loadPriceData(nodes, testSeedDir);

            expect(result.updatedNodes).toHaveLength(0);
            expect(updatedNodes[0].metadata.currentPrice).toBeUndefined();
            expect(updatedNodes[1].metadata.currentPrice).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should handle missing price files gracefully', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const nodes = [makeNode('R-01')];
            // No files written → both will fail to load
            const { nodes: updatedNodes, result } = loadPriceData(nodes, testSeedDir);

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('Failed to load price file'))).toBe(true);
            // Nodes should remain unchanged
            expect(updatedNodes[0].metadata.currentPrice).toBeUndefined();
            consoleSpy.mockRestore();
        });

        it('should handle empty prices array gracefully', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData({
                prices: [],
                latestPrice: undefined,
            }));
            writePriceFile('komis-price.json', makeKomisPriceData({
                prices: [],
            }));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const nodes = [makeNode('R-01')];
            const { result } = loadPriceData(nodes, testSeedDir);

            expect(result.errors.some(e => e.includes('no price entries found'))).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should continue processing when one file fails', () => {
            // Only komis-price.json exists (lithium-prices.json missing)
            writePriceFile('komis-price.json', makeKomisPriceData());

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const nodes = [makeNode('R-01')];
            const { nodes: updatedNodes, result } = loadPriceData(nodes, testSeedDir);

            // Should have error for missing file but still succeed with komis
            expect(result.errors.some(e => e.includes('Failed to load price file'))).toBe(true);
            expect(result.updatedNodes).toContain('R-01');
            expect(updatedNodes[0].metadata.currentPrice).toBeDefined();
            consoleSpy.mockRestore();
        });
    });

    describe('normalization pipeline', () => {
        it('should invoke normalization pipeline for price records', () => {
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData());
            writePriceFile('komis-price.json', makeKomisPriceData());

            const nodes = [makeNode('R-01')];
            // If normalization fails (e.g. invalid source), it should report error
            const { result } = loadPriceData(nodes, testSeedDir);

            // Both files should pass normalization successfully
            expect(result.errors.filter(e => e.includes('normalization failed'))).toHaveLength(0);
        });

        it('should report error when normalization rejects a record', () => {
            // source is empty → normalization should fail
            writePriceFile('prices/lithium-prices.json', makeLithiumPriceData({ source: '' }));
            writePriceFile('komis-price.json', makeKomisPriceData({ source: '' }));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const nodes = [makeNode('R-01')];
            const { result } = loadPriceData(nodes, testSeedDir);

            expect(result.errors.some(e => e.includes('normalization failed'))).toBe(true);
            consoleSpy.mockRestore();
        });
    });
});
