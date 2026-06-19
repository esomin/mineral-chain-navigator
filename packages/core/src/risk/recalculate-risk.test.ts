import { describe, it, expect } from 'vitest';
import { recalculateAffected, getAffectedEntityIds } from './recalculate-risk.js';
import type { SupplyChainNode, SupplyChainEdge, Country } from '@navigator/shared';

const makeNode = (overrides?: Partial<SupplyChainNode>): SupplyChainNode => ({
    id: 'N-01',
    type: 'Refinery',
    name: 'Test Node',
    country: 'China',
    coordinates: { latitude: 27.8, longitude: 114.9 },
    metadata: {
        productionCapacity: 100000,
        capacityUnit: 'tons_lce',
    },
    description: 'Test node',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
});

const makeEdge = (overrides?: Partial<SupplyChainEdge>): SupplyChainEdge => ({
    id: 'E-01',
    type: 'Supply',
    sourceNodeId: 'N-01',
    targetNodeId: 'N-02',
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

const defaultWgiScores: Map<Country, number> = new Map([
    ['China', 58.51],
    ['Chile', 66.00],
    ['SouthKorea', 73.84],
    ['Japan', 80.55],
    ['UnitedStates', 78.00],
    ['NA', 50.00],
]);

describe('getAffectedEntityIds', () => {
    it('should return changed node itself when no edges exist', () => {
        const result = getAffectedEntityIds(['N-01'], []);
        expect(result.nodeIds).toContain('N-01');
        expect(result.nodeIds.size).toBe(1);
        expect(result.edgeIds.size).toBe(0);
    });

    it('should include neighbor nodes connected by edges', () => {
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02' }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-03', targetNodeId: 'N-01' }),
        ];

        const result = getAffectedEntityIds(['N-01'], edges);

        expect(result.nodeIds).toContain('N-01');
        expect(result.nodeIds).toContain('N-02');
        expect(result.nodeIds).toContain('N-03');
        expect(result.edgeIds).toContain('E-01');
        expect(result.edgeIds).toContain('E-02');
    });

    it('should include edges where source or target is a changed node', () => {
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02' }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-03', targetNodeId: 'N-04' }),
        ];

        const result = getAffectedEntityIds(['N-01'], edges);

        expect(result.edgeIds).toContain('E-01');
        expect(result.edgeIds).not.toContain('E-02');
    });

    it('should handle multiple changed nodes', () => {
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02' }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-03', targetNodeId: 'N-04' }),
        ];

        const result = getAffectedEntityIds(['N-01', 'N-03'], edges);

        expect(result.nodeIds.size).toBe(4);
        expect(result.edgeIds.size).toBe(2);
    });

    it('should return empty sets for empty input', () => {
        const result = getAffectedEntityIds([], [makeEdge()]);
        expect(result.nodeIds.size).toBe(0);
        expect(result.edgeIds.size).toBe(0);
    });
});

describe('recalculateAffected', () => {
    it('should return empty array for empty changedNodeIds', () => {
        const nodes = [makeNode()];
        const edges = [makeEdge()];
        const result = recalculateAffected([], nodes, edges, defaultWgiScores);
        expect(result).toEqual([]);
    });

    it('should recalculate risk for the changed node itself', () => {
        const nodes = [makeNode({ id: 'N-01', country: 'China' })];
        const edges: SupplyChainEdge[] = [];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        expect(result).toHaveLength(1);
        expect(result[0].entityId).toBe('N-01');
        expect(result[0].entityType).toBe('node');
    });

    it('should recalculate downstream/upstream neighbors when a node changes', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'SouthKorea' }),
            makeNode({ id: 'N-03', country: 'Japan' }),
        ];
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02', attributes: { volume: 5000 } }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-01', targetNodeId: 'N-03', attributes: { volume: 3000 } }),
        ];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        const nodeResults = result.filter((r) => r.entityType === 'node');
        const nodeIds = nodeResults.map((r) => r.entityId);

        expect(nodeIds).toContain('N-01');
        expect(nodeIds).toContain('N-02');
        expect(nodeIds).toContain('N-03');
    });

    it('should recalculate edges connected to changed nodes', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'SouthKorea' }),
        ];
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02', attributes: { volume: 5000, iraCompliant: false } }),
        ];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        const edgeResults = result.filter((r) => r.entityType === 'edge');
        expect(edgeResults).toHaveLength(1);
        expect(edgeResults[0].entityId).toBe('E-01');
    });

    it('should correctly compute node HHI using inbound edges', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'SouthKorea' }),
            makeNode({ id: 'N-03', country: 'Japan' }),
        ];
        // N-02 has two inbound: N-01 (5000) and N-03 (5000) → HHI = 5000
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02', attributes: { volume: 5000 } }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-03', targetNodeId: 'N-02', attributes: { volume: 5000 } }),
        ];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        const n02Risk = result.find((r) => r.entityId === 'N-02' && r.entityType === 'node');
        expect(n02Risk).toBeDefined();
        // HHI=5000 → normalized 50, WGI for SouthKorea=73.84 → risk 26.16
        // score = 0.6 * 50 + 0.4 * 26.16 = 30 + 10.464 = 40.464
        expect(n02Risk!.score).toBeCloseTo(40.464);
    });

    it('should use WGI score based on node country', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'Japan' }),
        ];

        const result = recalculateAffected(['N-01'], nodes, [], defaultWgiScores);

        const nodeRisk = result.find((r) => r.entityId === 'N-01');
        expect(nodeRisk).toBeDefined();
        // HHI=0 (no inbound), WGI for Japan=80.55 → risk 19.45
        // score = 0.6 * 0 + 0.4 * 19.45 = 7.78
        expect(nodeRisk!.score).toBeCloseTo(7.78);
    });

    it('should default WGI to 50 when country not in map', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'NA' as Country }),
        ];
        const wgiWithoutNA = new Map<Country, number>([
            ['China', 58.51],
        ]);

        const result = recalculateAffected(['N-01'], nodes, [], wgiWithoutNA);

        const nodeRisk = result.find((r) => r.entityId === 'N-01');
        // HHI=0, WGI default=50 → risk 50
        // score = 0.6 * 0 + 0.4 * 50 = 20
        expect(nodeRisk!.score).toBeCloseTo(20);
    });

    it('should handle multiple changed nodes correctly', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'Chile' }),
            makeNode({ id: 'N-03', country: 'SouthKorea' }),
        ];
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-03', attributes: { volume: 7000 } }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-02', targetNodeId: 'N-03', attributes: { volume: 3000 } }),
        ];

        const result = recalculateAffected(['N-01', 'N-02'], nodes, edges, defaultWgiScores);

        const nodeResults = result.filter((r) => r.entityType === 'node');
        const edgeResults = result.filter((r) => r.entityType === 'edge');

        // All 3 nodes should be recalculated (N-01, N-02 changed + N-03 neighbor)
        expect(nodeResults).toHaveLength(3);
        // Both edges should be recalculated
        expect(edgeResults).toHaveLength(2);
    });

    it('should compute correct trade dependency for edges', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'SouthKorea' }),
            makeNode({ id: 'N-03', country: 'Japan' }),
        ];
        // N-03 has two inbound: N-01 (7000) and N-02 (3000)
        // E-01 tradeDependency = 7000/10000 = 0.7
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-03', attributes: { volume: 7000, iraCompliant: true } }),
            makeEdge({ id: 'E-02', sourceNodeId: 'N-02', targetNodeId: 'N-03', attributes: { volume: 3000, iraCompliant: false } }),
        ];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        const e01Risk = result.find((r) => r.entityId === 'E-01' && r.entityType === 'edge');
        expect(e01Risk).toBeDefined();
        // tradeDependency=0.7 → normalized 70, regulatoryRisk=10 (iraCompliant=true)
        // score = 0.5 * 70 + 0.5 * 10 = 35 + 5 = 40
        expect(e01Risk!.score).toBe(40);
    });

    it('should assign correct regulatory risk based on IRA compliance', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'SouthKorea' }),
        ];
        const edges = [
            makeEdge({ id: 'E-01', sourceNodeId: 'N-01', targetNodeId: 'N-02', attributes: { volume: 5000, iraCompliant: false } }),
        ];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        const e01Risk = result.find((r) => r.entityId === 'E-01' && r.entityType === 'edge');
        expect(e01Risk).toBeDefined();
        // tradeDependency=1.0 (sole supplier) → normalized 100, regulatoryRisk=80 (non-compliant)
        // score = 0.5 * 100 + 0.5 * 80 = 50 + 40 = 90
        expect(e01Risk!.score).toBe(90);
    });

    it('should only recalculate itself when node has no connections', () => {
        const nodes = [
            makeNode({ id: 'N-01', country: 'China' }),
            makeNode({ id: 'N-02', country: 'Japan' }),
        ];
        // No edges connecting these nodes
        const edges: SupplyChainEdge[] = [];

        const result = recalculateAffected(['N-01'], nodes, edges, defaultWgiScores);

        expect(result).toHaveLength(1);
        expect(result[0].entityId).toBe('N-01');
        expect(result[0].entityType).toBe('node');
    });
});
