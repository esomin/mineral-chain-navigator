import { describe, it, expect } from 'vitest';
import { validateNodeType, validateEdgeType, validateCountry, validateNodeInput, validateEdgeInput } from './graph-validators.js';
import type { CreateNodeInput, CreateEdgeInput } from '../types/graph.js';

describe('validateNodeType', () => {
    it('accepts valid node types', () => {
        expect(validateNodeType('Resource')).toBe(true);
        expect(validateNodeType('Mine')).toBe(true);
        expect(validateNodeType('Refinery')).toBe(true);
        expect(validateNodeType('Factory')).toBe(true);
    });

    it('rejects invalid node types', () => {
        expect(validateNodeType('Gigafactory')).toBe(false);
        expect(validateNodeType('Country')).toBe(false);
        expect(validateNodeType('Policy')).toBe(false);
        expect(validateNodeType('')).toBe(false);
        expect(validateNodeType('mine')).toBe(false);
    });
});

describe('validateEdgeType', () => {
    it('accepts valid edge types', () => {
        expect(validateEdgeType('Supply')).toBe(true);
        expect(validateEdgeType('Delivery')).toBe(true);
    });

    it('rejects invalid edge types', () => {
        expect(validateEdgeType('Export_Restriction')).toBe(false);
        expect(validateEdgeType('Ownership')).toBe(false);
        expect(validateEdgeType('')).toBe(false);
    });
});

describe('validateCountry', () => {
    it('accepts valid countries', () => {
        expect(validateCountry('SouthKorea')).toBe(true);
        expect(validateCountry('Japan')).toBe(true);
        expect(validateCountry('China')).toBe(true);
        expect(validateCountry('Chile')).toBe(true);
        expect(validateCountry('UnitedStates')).toBe(true);
        expect(validateCountry('NA')).toBe(true);
    });

    it('rejects invalid countries', () => {
        expect(validateCountry('Australia')).toBe(false);
        expect(validateCountry('Korea')).toBe(false);
        expect(validateCountry('')).toBe(false);
    });
});

describe('validateNodeInput', () => {
    const validInput: CreateNodeInput = {
        id: 'RF-01',
        type: 'Refinery',
        name: 'Ganfeng Xinyu Plant',
        country: 'China',
        coordinates: { latitude: 27.8, longitude: 114.9 },
        metadata: { productionCapacity: 100000, capacityUnit: 'tons' },
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
        const result = validateNodeInput({ ...validInput, type: 'Gigafactory' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('rejects invalid country', () => {
        const result = validateNodeInput({ ...validInput, country: 'Australia' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('country'))).toBe(true);
    });

    it('rejects invalid coordinates', () => {
        const result = validateNodeInput({
            ...validInput,
            coordinates: { latitude: 100, longitude: 200 },
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('latitude'))).toBe(true);
        expect(result.errors.some(e => e.includes('longitude'))).toBe(true);
    });

    it('rejects missing metadata', () => {
        const result = validateNodeInput({ ...validInput, metadata: undefined as any });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('metadata'))).toBe(true);
    });

    it('rejects negative productionCapacity', () => {
        const result = validateNodeInput({
            ...validInput,
            metadata: { productionCapacity: -1, capacityUnit: 'tons' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('productionCapacity'))).toBe(true);
    });

    it('rejects invalid capacityUnit', () => {
        const result = validateNodeInput({
            ...validInput,
            metadata: { productionCapacity: 100, capacityUnit: 'barrels' },
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('capacityUnit'))).toBe(true);
    });
});

describe('validateEdgeInput', () => {
    const existingNodeIds = new Set(['M-01', 'RF-01', 'F-01']);

    const validEdge: CreateEdgeInput = {
        id: 'E-01',
        type: 'Supply',
        sourceNodeId: 'M-01',
        targetNodeId: 'RF-01',
    };

    it('accepts valid edge input', () => {
        const result = validateEdgeInput(validEdge, existingNodeIds);
        expect(result.valid).toBe(true);
    });

    it('rejects invalid edge type', () => {
        const result = validateEdgeInput({ ...validEdge, type: 'Ownership' }, existingNodeIds);
        expect(result.valid).toBe(false);
    });

    it('rejects non-existent source node', () => {
        const result = validateEdgeInput({ ...validEdge, sourceNodeId: 'X-99' }, existingNodeIds);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('sourceNodeId'))).toBe(true);
    });

    it('rejects non-existent target node', () => {
        const result = validateEdgeInput({ ...validEdge, targetNodeId: 'X-99' }, existingNodeIds);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('targetNodeId'))).toBe(true);
    });
});
