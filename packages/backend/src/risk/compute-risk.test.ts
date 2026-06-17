import { describe, it, expect } from 'vitest';
import {
    computeNodeHHI,
    computeNodeRisk,
    computeEdgeRisk,
    normalizeHHI,
    normalizeWGI,
    DEFAULT_HHI_WEIGHT,
    DEFAULT_WGI_WEIGHT,
    DEFAULT_TRADE_VOLUME_WEIGHT,
    DEFAULT_REGULATORY_WEIGHT,
} from './compute-risk.js';
import type { SupplyChainNode, SupplyChainEdge } from '@mineral-chain/shared';

const makeNode = (overrides?: Partial<SupplyChainNode>): SupplyChainNode => ({
    id: 'RF-01',
    type: 'Refinery',
    name: 'Ganfeng Xinyu',
    country: 'China',
    coordinates: { latitude: 27.8, longitude: 114.9 },
    metadata: {
        productionCapacity: 100000,
        capacityUnit: 'tons_lce',
    },
    description: 'Test refinery node',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
});

const makeEdge = (overrides?: Partial<SupplyChainEdge>): SupplyChainEdge => ({
    id: 'E-01',
    type: 'Supply',
    sourceNodeId: 'M-01',
    targetNodeId: 'RF-01',
    attributes: {
        volume: 50000,
        price: 1000000,
        unitPrice: 20,
        priceType: 'fob',
        hsCode: '282520',
        year: 2025,
        iraCompliant: false,
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
});

describe('normalizeHHI', () => {
    it('should normalize 0 to 0', () => {
        expect(normalizeHHI(0)).toBe(0);
    });

    it('should normalize 10000 to 100', () => {
        expect(normalizeHHI(10000)).toBe(100);
    });

    it('should normalize 2500 (moderately concentrated) to 25', () => {
        expect(normalizeHHI(2500)).toBe(25);
    });

    it('should clamp values below 0', () => {
        expect(normalizeHHI(-100)).toBe(0);
    });

    it('should clamp values above 10000', () => {
        expect(normalizeHHI(15000)).toBe(100);
    });
});

describe('normalizeWGI', () => {
    it('should normalize 100 (best governance) to 0 risk', () => {
        expect(normalizeWGI(100)).toBe(0);
    });

    it('should normalize 0 (worst governance) to 100 risk', () => {
        expect(normalizeWGI(0)).toBe(100);
    });

    it('should normalize 50 (middle) to 50 risk', () => {
        expect(normalizeWGI(50)).toBe(50);
    });

    it('should normalize China composite (58.51) to ~41.49 risk', () => {
        expect(normalizeWGI(58.51)).toBeCloseTo(41.49);
    });

    it('should normalize Japan composite (80.55) to ~19.45 risk', () => {
        expect(normalizeWGI(80.55)).toBeCloseTo(19.45);
    });

    it('should clamp values below 0', () => {
        expect(normalizeWGI(-10)).toBe(100);
    });

    it('should clamp values above 100', () => {
        expect(normalizeWGI(150)).toBe(0);
    });
});

describe('computeNodeHHI', () => {
    it('should return 0 when no inbound edges', () => {
        expect(computeNodeHHI('F-01', [])).toBe(0);
    });

    it('should return 10000 when single supplier (100% concentration)', () => {
        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-1', sourceNodeId: 'RF-01', targetNodeId: 'F-05', attributes: { volume: 10000 } }),
        ];
        expect(computeNodeHHI('F-05', edges)).toBe(10000);
    });

    it('should return 5000 for two equal suppliers (50/50)', () => {
        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-1', sourceNodeId: 'RF-01', targetNodeId: 'F-01', attributes: { volume: 5000 } }),
            makeEdge({ id: 'E-2', sourceNodeId: 'RF-04', targetNodeId: 'F-01', attributes: { volume: 5000 } }),
        ];
        expect(computeNodeHHI('F-01', edges)).toBe(5000);
    });

    it('should compute HHI for F-04 (CATL) from trade-flows data', () => {
        // RF-01 → F-04: 50,000,000  RF-02 → F-04: 30,000,000  total: 80,000,000
        // shares: 62.5%, 37.5%  → HHI = 62.5² + 37.5² = 3906.25 + 1406.25 = 5313
        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-RF01-F04', sourceNodeId: 'RF-01', targetNodeId: 'F-04', attributes: { volume: 50000000 } }),
            makeEdge({ id: 'E-RF02-F04', sourceNodeId: 'RF-02', targetNodeId: 'F-04', attributes: { volume: 30000000 } }),
        ];
        expect(computeNodeHHI('F-04', edges)).toBe(5313);
    });

    it('should compute HHI for F-01 (EcoPro) from trade-flows data', () => {
        // RF-01: 17,984,102  RF-02: 3,732,090  RF-03: 19,281,694  RF-04: 20,000,000
        // total: 60,997,886
        // shares: 29.48%, 6.12%, 31.61%, 32.79%
        // HHI = 29.48² + 6.12² + 31.61² + 32.79² = 869 + 37 + 999 + 1075 = 2981
        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-RF01-F01', sourceNodeId: 'RF-01', targetNodeId: 'F-01', attributes: { volume: 17984102 } }),
            makeEdge({ id: 'E-RF02-F01', sourceNodeId: 'RF-02', targetNodeId: 'F-01', attributes: { volume: 3732090 } }),
            makeEdge({ id: 'E-RF03-F01', sourceNodeId: 'RF-03', targetNodeId: 'F-01', attributes: { volume: 19281694 } }),
            makeEdge({ id: 'E-RF04-F01', sourceNodeId: 'RF-04', targetNodeId: 'F-01', attributes: { volume: 20000000 } }),
        ];
        const hhi = computeNodeHHI('F-01', edges);
        // approximately 2981
        expect(hhi).toBeGreaterThan(2900);
        expect(hhi).toBeLessThan(3100);
    });

    it('should ignore edges not targeting the specified node', () => {
        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-1', sourceNodeId: 'RF-01', targetNodeId: 'F-01', attributes: { volume: 5000 } }),
            makeEdge({ id: 'E-2', sourceNodeId: 'RF-01', targetNodeId: 'F-02', attributes: { volume: 8000 } }),
        ];
        // F-01 has only 1 inbound → HHI = 10000
        expect(computeNodeHHI('F-01', edges)).toBe(10000);
    });

    it('should ignore edges with no volume', () => {
        const edges: SupplyChainEdge[] = [
            makeEdge({ id: 'E-1', sourceNodeId: 'R-01', targetNodeId: 'M-01', attributes: { description: 'no volume' } }),
        ];
        expect(computeNodeHHI('M-01', edges)).toBe(0);
    });
});

describe('computeNodeRisk', () => {
    it('should compute risk score for a node with known HHI and WGI inputs', () => {
        const node = makeNode();
        // HHI=5000 → normalized 50; WGI=58.51 (China composite) → risk 41.49
        const result = computeNodeRisk(node, { hhi: 5000, wgi: 58.51 });

        expect(result.entityId).toBe('RF-01');
        expect(result.entityType).toBe('node');
        // score = 0.6 * 50 + 0.4 * 41.49 = 30 + 16.596 = 46.596
        expect(result.score).toBeCloseTo(46.596);
    });

    it('should include both HHI and WGI factors', () => {
        const node = makeNode();
        const result = computeNodeRisk(node, { hhi: 2500, wgi: 73.84 });

        expect(result.factors).toHaveLength(2);

        const hhiFactor = result.factors.find(f => f.category === 'supply_concentration');
        const wgiFactor = result.factors.find(f => f.category === 'geopolitical');

        expect(hhiFactor).toBeDefined();
        expect(wgiFactor).toBeDefined();
        expect(hhiFactor!.weight).toBe(DEFAULT_HHI_WEIGHT);
        expect(wgiFactor!.weight).toBe(DEFAULT_WGI_WEIGHT);
    });

    it('should produce score normalized to 0-100 range', () => {
        // Minimum risk: HHI=0, WGI=100 (best governance)
        const minResult = computeNodeRisk(makeNode(), { hhi: 0, wgi: 100 });
        expect(minResult.score).toBeGreaterThanOrEqual(0);
        expect(minResult.score).toBeLessThanOrEqual(100);
        expect(minResult.score).toBe(0);

        // Maximum risk: HHI=10000, WGI=0 (worst governance)
        const maxResult = computeNodeRisk(makeNode(), { hhi: 10000, wgi: 0 });
        expect(maxResult.score).toBeGreaterThanOrEqual(0);
        expect(maxResult.score).toBeLessThanOrEqual(100);
        expect(maxResult.score).toBe(100);
    });

    it('should store raw values in factors', () => {
        const node = makeNode();
        const result = computeNodeRisk(node, { hhi: 3000, wgi: 70.23 });

        const hhiFactor = result.factors.find(f => f.category === 'supply_concentration')!;
        const wgiFactor = result.factors.find(f => f.category === 'geopolitical')!;

        expect(hhiFactor.rawValue).toBe(3000);
        expect(wgiFactor.rawValue).toBe(70.23);
    });

    it('should set computedAt timestamp', () => {
        const before = new Date();
        const result = computeNodeRisk(makeNode(), { hhi: 1000, wgi: 50 });
        const after = new Date();

        expect(result.computedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(result.computedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should compute high-risk score for China refinery (high HHI, low WGI composite)', () => {
        const node = makeNode({ id: 'RF-01', country: 'China' });
        // China: HHI ~7000 (highly concentrated), WGI composite 58.51 → risk 41.49
        const result = computeNodeRisk(node, { hhi: 7000, wgi: 58.51 });

        // score = 0.6 * 70 + 0.4 * 41.49 = 42 + 16.596 = 58.596
        expect(result.score).toBeCloseTo(58.596);
    });

    it('should compute low-risk score for Japan factory (low HHI, high WGI composite)', () => {
        const node = makeNode({ id: 'F-03', country: 'Japan', type: 'Factory' });
        // Japan: HHI ~1500 (low concentration), WGI composite 80.55 → risk 19.45
        const result = computeNodeRisk(node, { hhi: 1500, wgi: 80.55 });

        // score = 0.6 * 15 + 0.4 * 19.45 = 9 + 7.78 = 16.78
        expect(result.score).toBeCloseTo(16.78);
    });
});

describe('computeEdgeRisk', () => {
    it('should compute risk score for an edge with known inputs', () => {
        const edge = makeEdge();
        // tradeDependency=0.8 → normalized 80; regulatoryRisk=60
        const result = computeEdgeRisk(edge, { tradeDependency: 0.8, regulatoryRisk: 60 });

        expect(result.entityId).toBe('E-01');
        expect(result.entityType).toBe('edge');
        // score = 0.5 * 80 + 0.5 * 60 = 40 + 30 = 70
        expect(result.score).toBe(70);
    });

    it('should include both trade_volume and regulatory factors', () => {
        const edge = makeEdge();
        const result = computeEdgeRisk(edge, { tradeDependency: 0.5, regulatoryRisk: 50 });

        expect(result.factors).toHaveLength(2);

        const tradeFactor = result.factors.find(f => f.category === 'trade_volume');
        const regFactor = result.factors.find(f => f.category === 'regulatory');

        expect(tradeFactor).toBeDefined();
        expect(regFactor).toBeDefined();
        expect(tradeFactor!.weight).toBe(DEFAULT_TRADE_VOLUME_WEIGHT);
        expect(regFactor!.weight).toBe(DEFAULT_REGULATORY_WEIGHT);
    });

    it('should produce score normalized to 0-100 range', () => {
        // Minimum risk: dependency=0, regulatory=0
        const minResult = computeEdgeRisk(makeEdge(), { tradeDependency: 0, regulatoryRisk: 0 });
        expect(minResult.score).toBe(0);

        // Maximum risk: dependency=1, regulatory=100
        const maxResult = computeEdgeRisk(makeEdge(), { tradeDependency: 1, regulatoryRisk: 100 });
        expect(maxResult.score).toBe(100);
    });

    it('should clamp tradeDependency above 1 to 1', () => {
        const result = computeEdgeRisk(makeEdge(), { tradeDependency: 1.5, regulatoryRisk: 0 });
        const tradeFactor = result.factors.find(f => f.category === 'trade_volume')!;
        expect(tradeFactor.normalizedValue).toBe(100);
    });

    it('should clamp regulatoryRisk above 100 to 100', () => {
        const result = computeEdgeRisk(makeEdge(), { tradeDependency: 0, regulatoryRisk: 150 });
        const regFactor = result.factors.find(f => f.category === 'regulatory')!;
        expect(regFactor.normalizedValue).toBe(100);
    });

    it('should store raw values in factors', () => {
        const edge = makeEdge();
        const result = computeEdgeRisk(edge, { tradeDependency: 0.65, regulatoryRisk: 42 });

        const tradeFactor = result.factors.find(f => f.category === 'trade_volume')!;
        const regFactor = result.factors.find(f => f.category === 'regulatory')!;

        expect(tradeFactor.rawValue).toBe(0.65);
        expect(regFactor.rawValue).toBe(42);
    });

    it('should compute risk for IRA non-compliant edge', () => {
        const edge = makeEdge({
            attributes: { iraCompliant: false, volume: 30000, price: 600000 },
        });
        // High regulatory risk for non-compliant, moderate dependency
        const result = computeEdgeRisk(edge, { tradeDependency: 0.4, regulatoryRisk: 85 });

        // score = 0.5 * 40 + 0.5 * 85 = 20 + 42.5 = 62.5
        expect(result.score).toBe(62.5);
    });
});
