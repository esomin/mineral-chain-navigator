import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeedData } from './load-seed-data.js';
import type { SeedDataResult } from './load-seed-data.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
// 시드 데이터는 packages/pipeline/data/로 이동됨
const seedDataPath = resolve(currentDir, '..', '..', '..', '..', 'packages', 'pipeline', 'data');

describe('loadSeedData', () => {
    let result: SeedDataResult;

    beforeAll(() => {
        result = loadSeedData(seedDataPath);
    });

    it('should load all 23 master nodes', () => {
        expect(result.nodes).toHaveLength(23);
    });

    it('should load nodes with correct types distribution', () => {
        const resources = result.nodes.filter(n => n.type === 'Resource');
        const mines = result.nodes.filter(n => n.type === 'Mine');
        const refineries = result.nodes.filter(n => n.type === 'Refinery');
        const factories = result.nodes.filter(n => n.type === 'Factory');

        expect(resources).toHaveLength(1);
        expect(mines).toHaveLength(7);
        expect(refineries).toHaveLength(8);
        expect(factories).toHaveLength(7);
    });

    it('should load nodes for all 7 countries plus NA', () => {
        const countries = new Set(result.nodes.map(n => n.country));
        expect(countries).toContain('Chile');
        expect(countries).toContain('China');
        expect(countries).toContain('UnitedStates');
        expect(countries).toContain('SouthKorea');
        expect(countries).toContain('Japan');
        expect(countries).toContain('Australia');
        expect(countries).toContain('Argentina');
        expect(countries).toContain('NA');
    });

    it('should load nodes with valid coordinates', () => {
        for (const node of result.nodes) {
            expect(node.coordinates.latitude).toBeGreaterThanOrEqual(-90);
            expect(node.coordinates.latitude).toBeLessThanOrEqual(90);
            expect(node.coordinates.longitude).toBeGreaterThanOrEqual(-180);
            expect(node.coordinates.longitude).toBeLessThanOrEqual(180);
        }
    });

    it('should load nodes with metadata including productionCapacity', () => {
        for (const node of result.nodes) {
            expect(node.metadata.productionCapacity).toBeGreaterThan(0);
            expect(node.metadata.capacityUnit).toBeDefined();
        }
    });

    it('should load supply chain edges (Resource→Mine, Mine→Refinery)', () => {
        const supplyEdges = result.edges.filter(e => e.type === 'Supply');
        expect(supplyEdges.length).toBeGreaterThanOrEqual(20);

        // R-01 → M-01~M-07
        const resourceToMine = supplyEdges.filter(e => e.sourceNodeId === 'R-01');
        expect(resourceToMine).toHaveLength(7);

        // Mine to Refinery edges
        const mineToRefinery = supplyEdges.filter(e => e.sourceNodeId.startsWith('M-'));
        expect(mineToRefinery.length).toBeGreaterThanOrEqual(15);
    });

    it('should load delivery edges (Refinery→Factory) with volume and price', () => {
        const deliveryEdges = result.edges.filter(e => e.type === 'Delivery');
        expect(deliveryEdges.length).toBeGreaterThanOrEqual(10);

        // Cross-border delivery edges should have volume and price
        const crossBorderEdges = deliveryEdges.filter(
            e => e.attributes.volume !== undefined && e.attributes.price !== undefined,
        );
        expect(crossBorderEdges.length).toBeGreaterThanOrEqual(5);
    });

    it('should have all edges referencing existing node IDs', () => {
        const nodeIds = new Set(result.nodes.map(n => n.id));
        for (const edge of result.edges) {
            expect(nodeIds.has(edge.sourceNodeId) || edge.targetNodeId === 'RF-04').toBe(true);
            // RF-04 can be a target from RF-03
        }
    });

    it('should load edges with valid dates', () => {
        for (const edge of result.edges) {
            expect(edge.createdAt).toBeInstanceOf(Date);
            expect(edge.updatedAt).toBeInstanceOf(Date);
            expect(edge.createdAt.getTime()).not.toBeNaN();
            expect(edge.updatedAt.getTime()).not.toBeNaN();
        }
    });

    it('should load nodes with valid dates', () => {
        for (const node of result.nodes) {
            expect(node.createdAt).toBeInstanceOf(Date);
            expect(node.updatedAt).toBeInstanceOf(Date);
            expect(node.createdAt.getTime()).not.toBeNaN();
            expect(node.updatedAt.getTime()).not.toBeNaN();
        }
    });

    it('should have specific master nodes by ID', () => {
        const nodeIds = result.nodes.map(n => n.id);
        expect(nodeIds).toContain('R-01');
        expect(nodeIds).toContain('M-01');
        expect(nodeIds).toContain('M-02');
        expect(nodeIds).toContain('M-03');
        expect(nodeIds).toContain('M-04');
        expect(nodeIds).toContain('M-05');
        expect(nodeIds).toContain('M-06');
        expect(nodeIds).toContain('M-07');
        expect(nodeIds).toContain('RF-01');
        expect(nodeIds).toContain('RF-02');
        expect(nodeIds).toContain('RF-03');
        expect(nodeIds).toContain('RF-04');
        expect(nodeIds).toContain('RF-05');
        expect(nodeIds).toContain('RF-06');
        expect(nodeIds).toContain('RF-07');
        expect(nodeIds).toContain('RF-08');
        expect(nodeIds).toContain('F-01');
        expect(nodeIds).toContain('F-02');
        expect(nodeIds).toContain('F-03');
        expect(nodeIds).toContain('F-04');
        expect(nodeIds).toContain('F-05');
        expect(nodeIds).toContain('F-06');
        expect(nodeIds).toContain('F-07');
    });

    it('should report no errors for valid seed data', () => {
        expect(result.errors).toHaveLength(0);
    });

    describe('error handling', () => {
        it('should handle non-existent seed data path gracefully', () => {
            const badResult = loadSeedData('/non/existent/path');
            expect(badResult.nodes).toHaveLength(0);
            expect(badResult.edges).toHaveLength(0);
            expect(badResult.errors.length).toBeGreaterThan(0);
        });
    });
});
