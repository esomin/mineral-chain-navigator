import type { NodeType, EdgeType, CreateNodeInput, CreateEdgeInput, ValidationResult } from '../types/graph.js';

const VALID_NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
    'Resource',
    'Mine',
    'Refinery',
    'Gigafactory',
    'Country',
    'Policy',
]);

const VALID_EDGE_TYPES: ReadonlySet<string> = new Set<EdgeType>([
    'Supply',
    'Delivery',
    'Export_Restriction',
    'Ownership',
]);

/**
 * Validates whether the given string is a valid NodeType.
 */
export function validateNodeType(type: string): boolean {
    return VALID_NODE_TYPES.has(type);
}

/**
 * Validates whether the given string is a valid EdgeType.
 */
export function validateEdgeType(type: string): boolean {
    return VALID_EDGE_TYPES.has(type);
}

/**
 * Validates node creation input: required attributes and coordinate ranges.
 */
export function validateNodeInput(input: CreateNodeInput): ValidationResult {
    const errors: string[] = [];

    if (!input.id || typeof input.id !== 'string' || input.id.trim() === '') {
        errors.push('id is required and must be a non-empty string');
    }

    if (!input.type || !validateNodeType(input.type)) {
        errors.push('type is required and must be a valid NodeType');
    }

    if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
        errors.push('name is required and must be a non-empty string');
    }

    if (!input.coordinates) {
        errors.push('coordinates is required');
    } else {
        const { latitude, longitude } = input.coordinates;
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
            errors.push('coordinates.latitude must be a number between -90 and 90');
        }
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
            errors.push('coordinates.longitude must be a number between -180 and 180');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates edge creation input: referential integrity and relationship type.
 */
export function validateEdgeInput(input: CreateEdgeInput, existingNodeIds: Set<string>): ValidationResult {
    const errors: string[] = [];

    if (!input.id || typeof input.id !== 'string' || input.id.trim() === '') {
        errors.push('id is required and must be a non-empty string');
    }

    if (!input.type || !validateEdgeType(input.type)) {
        errors.push('type is required and must be a valid EdgeType');
    }

    if (!input.sourceNodeId || typeof input.sourceNodeId !== 'string' || input.sourceNodeId.trim() === '') {
        errors.push('sourceNodeId is required and must be a non-empty string');
    } else if (!existingNodeIds.has(input.sourceNodeId)) {
        errors.push('sourceNodeId references a non-existent node');
    }

    if (!input.targetNodeId || typeof input.targetNodeId !== 'string' || input.targetNodeId.trim() === '') {
        errors.push('targetNodeId is required and must be a non-empty string');
    } else if (!existingNodeIds.has(input.targetNodeId)) {
        errors.push('targetNodeId references a non-existent node');
    }

    return { valid: errors.length === 0, errors };
}
