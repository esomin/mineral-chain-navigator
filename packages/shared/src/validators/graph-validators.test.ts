import { describe, it, expect } from 'vitest';
import { validateNodeType, validateEdgeType, validateNodeInput, validateEdgeInput } from './graph-validators.js';

describe('validateNodeType', () => {
    it('accepts all valid node types', () => {
        const validTypes = ['Resource', 'Mine', 'Refinery', 'Gigafactory', 'Country', 'Policy'];
        for (const type of validTypes) {
            expect(validateNodeType(type)).toBe(true);
        }
    });

    it('rejects invalid node types', () => {
        expect(validateNodeType('Invalid')).toBe(false);
        expect(validateNodeType('')).toBe(false);
        expect(validateNodeType('resource')).toBe(false); // case-sensitive
    });
});

describe('validateEdgeType', () => {
    it('accepts all valid edge types', () => {
        const validTypes = ['Supply', 'Delivery', 'Export_Restriction', 'Ownership'];
        for (const type of validTypes) {
            expect(validateEdgeType(type)).toBe(true);
        }
    });

    it('rejects invalid edge types', () => {
        expect(validateEdgeType('Invalid')).toBe(false);
        expect(validateEdgeType('')).toBe(false);
        expect(validateEdgeType('supply')).toBe(false); // case-sensitive
    });
});

describe('validateNodeInput', () => {
    const validInput = {
        id: 'node-1',
        type: 'Mine',
        name: 'Lithium Mine A',
        coordinates: { latitude: 37.5, longitude: 127.0 },
    };

    it('accepts valid node input', () => {
        const result = validateNodeInput(validInput);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects missing id', () => {
        const result = validateNodeInput({ ...validInput, id: '' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });

    it('rejects invalid type', () => {
        const result = validateNodeInput({ ...validInput, type: 'InvalidType' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('rejects missing name', () => {
        const result = validateNodeInput({ ...validInput, name: '' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('rejects latitude out of range', () => {
        const result = validateNodeInput({ ...validInput, coordinates: { latitude: 91, longitude: 0 } });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('latitude'))).toBe(true);
    });

    it('rejects longitude out of range', () => {
        const result = validateNodeInput({ ...validInput, coordinates: { latitude: 0, longitude: 181 } });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('longitude'))).toBe(true);
    });
});

describe('validateEdgeInput', () => {
    const existingNodes = new Set(['node-1', 'node-2', 'node-3']);
    const validInput = {
        id: 'edge-1',
        type: 'Supply',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
    };

    it('accepts valid edge input', () => {
        const result = validateEdgeInput(validInput, existingNodes);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid edge type', () => {
        const result = validateEdgeInput({ ...validInput, type: 'InvalidType' }, existingNodes);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('rejects non-existent source node', () => {
        const result = validateEdgeInput({ ...validInput, sourceNodeId: 'nonexistent' }, existingNodes);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('sourceNodeId'))).toBe(true);
    });

    it('rejects non-existent target node', () => {
        const result = validateEdgeInput({ ...validInput, targetNodeId: 'nonexistent' }, existingNodes);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('targetNodeId'))).toBe(true);
    });

    it('rejects missing id', () => {
        const result = validateEdgeInput({ ...validInput, id: '' }, existingNodes);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });
});
