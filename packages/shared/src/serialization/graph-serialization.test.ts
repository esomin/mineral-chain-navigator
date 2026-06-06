import { describe, it, expect } from 'vitest';
import { serializeNode, deserializeNode, serializeEdge, deserializeEdge } from './graph-serialization.js';
import type { SupplyChainNode, SupplyChainEdge } from '../types/graph.js';

describe('serializeNode / deserializeNode', () => {
    const node: SupplyChainNode = {
        id: 'node-1',
        type: 'Mine',
        name: 'Lithium Mine',
        coordinates: { latitude: -23.5, longitude: 134.2 },
        metadata: { productionCapacity: 50000, annualOutput: 42000 },
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
        updatedAt: new Date('2024-06-01T12:30:00.000Z'),
    };

    it('serializes a node to snake_case JSON format', () => {
        const serialized = serializeNode(node);
        expect(serialized.id).toBe('node-1');
        expect(serialized.type).toBe('Mine');
        expect(serialized.coordinates).toEqual({ lat: -23.5, lng: 134.2 });
        expect(serialized.created_at).toBe('2024-01-15T10:00:00.000Z');
        expect(serialized.updated_at).toBe('2024-06-01T12:30:00.000Z');
    });

    it('deserializes back to an equivalent node', () => {
        const serialized = serializeNode(node);
        const deserialized = deserializeNode(serialized);
        expect(deserialized.id).toBe(node.id);
        expect(deserialized.type).toBe(node.type);
        expect(deserialized.name).toBe(node.name);
        expect(deserialized.coordinates).toEqual(node.coordinates);
        expect(deserialized.createdAt.getTime()).toBe(node.createdAt.getTime());
        expect(deserialized.updatedAt.getTime()).toBe(node.updatedAt.getTime());
    });
});

describe('serializeEdge / deserializeEdge', () => {
    const edge: SupplyChainEdge = {
        id: 'edge-1',
        type: 'Supply',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        attributes: { volume: 1000, price: 45.5, hsCode: '2825' },
        createdAt: new Date('2024-02-01T08:00:00.000Z'),
        updatedAt: new Date('2024-05-20T16:45:00.000Z'),
    };

    it('serializes an edge to snake_case JSON format', () => {
        const serialized = serializeEdge(edge);
        expect(serialized.source_node_id).toBe('node-1');
        expect(serialized.target_node_id).toBe('node-2');
        expect(serialized.created_at).toBe('2024-02-01T08:00:00.000Z');
        expect(serialized.attributes).toEqual({ volume: 1000, price: 45.5, hsCode: '2825' });
    });

    it('deserializes back to an equivalent edge', () => {
        const serialized = serializeEdge(edge);
        const deserialized = deserializeEdge(serialized);
        expect(deserialized.id).toBe(edge.id);
        expect(deserialized.type).toBe(edge.type);
        expect(deserialized.sourceNodeId).toBe(edge.sourceNodeId);
        expect(deserialized.targetNodeId).toBe(edge.targetNodeId);
        expect(deserialized.attributes).toEqual(edge.attributes);
        expect(deserialized.createdAt.getTime()).toBe(edge.createdAt.getTime());
        expect(deserialized.updatedAt.getTime()).toBe(edge.updatedAt.getTime());
    });
});
