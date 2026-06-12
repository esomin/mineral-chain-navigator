import { describe, it, expect } from 'vitest';
import { serializeNode, deserializeNode, serializeEdge, deserializeEdge } from './graph-serialization.js';
import type { SupplyChainNode, SupplyChainEdge } from '../types/graph.js';

describe('serializeNode / deserializeNode', () => {
    const node: SupplyChainNode = {
        id: 'RF-01',
        type: 'Refinery',
        name: 'Ganfeng Xinyu Plant',
        country: 'China',
        coordinates: { latitude: 27.8, longitude: 114.9 },
        metadata: {
            productionCapacity: 100000,
            capacityUnit: 'tons',
            owner: 'Ganfeng Lithium',
        },
        description: '글로벌 1위 규모의 리튬 제련소',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-06-01T00:00:00.000Z'),
    };

    it('serializes node to JSON format', () => {
        const serialized = serializeNode(node);
        expect(serialized.id).toBe('RF-01');
        expect(serialized.type).toBe('Refinery');
        expect(serialized.country).toBe('China');
        expect(serialized.coordinates).toEqual({ lat: 27.8, lng: 114.9 });
        expect(serialized.description).toBe('글로벌 1위 규모의 리튬 제련소');
        expect(serialized.created_at).toBe('2025-01-01T00:00:00.000Z');
        expect(serialized.updated_at).toBe('2025-06-01T00:00:00.000Z');
    });

    it('round-trips node through serialize/deserialize', () => {
        const serialized = serializeNode(node);
        const deserialized = deserializeNode(serialized);
        expect(deserialized.id).toBe(node.id);
        expect(deserialized.type).toBe(node.type);
        expect(deserialized.name).toBe(node.name);
        expect(deserialized.country).toBe(node.country);
        expect(deserialized.coordinates).toEqual(node.coordinates);
        expect(deserialized.description).toBe(node.description);
        expect(deserialized.createdAt.getTime()).toBe(node.createdAt.getTime());
        expect(deserialized.updatedAt.getTime()).toBe(node.updatedAt.getTime());
    });
});

describe('serializeEdge / deserializeEdge', () => {
    const edge: SupplyChainEdge = {
        id: 'E-01',
        type: 'Supply',
        sourceNodeId: 'M-01',
        targetNodeId: 'RF-03',
        attributes: {
            volume: 50000,
            price: 500000000,
            hsCode: '282520',
            year: 2025,
            iraCompliant: true,
        },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-06-01T00:00:00.000Z'),
    };

    it('serializes edge to JSON format', () => {
        const serialized = serializeEdge(edge);
        expect(serialized.source_node_id).toBe('M-01');
        expect(serialized.target_node_id).toBe('RF-03');
        expect(serialized.attributes.hsCode).toBe('282520');
        expect(serialized.attributes.iraCompliant).toBe(true);
    });

    it('round-trips edge through serialize/deserialize', () => {
        const serialized = serializeEdge(edge);
        const deserialized = deserializeEdge(serialized);
        expect(deserialized.id).toBe(edge.id);
        expect(deserialized.type).toBe(edge.type);
        expect(deserialized.sourceNodeId).toBe(edge.sourceNodeId);
        expect(deserialized.targetNodeId).toBe(edge.targetNodeId);
        expect(deserialized.attributes.iraCompliant).toBe(true);
        expect(deserialized.createdAt.getTime()).toBe(edge.createdAt.getTime());
    });
});
