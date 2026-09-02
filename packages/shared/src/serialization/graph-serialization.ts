import type { SupplyChainNode, SupplyChainEdge } from '../types/graph.js';
import type { SerializedNode, SerializedEdge } from '../types/serialization.js';

/**
 * Serializes a SupplyChainNode to JSON-compatible format.
 * Converts camelCase to snake_case and Date to ISO 8601 string.
 */
export function serializeNode(node: SupplyChainNode): SerializedNode {
    return {
        id: node.id,
        type: node.type,
        name: node.name,
        country: node.country,
        coordinates: {
            lat: node.coordinates.latitude,
            lng: node.coordinates.longitude,
        },
        metadata: { ...node.metadata } as Record<string, unknown>,
        description: node.description,
        created_at: node.createdAt.toISOString(),
        updated_at: node.updatedAt.toISOString(),
    };
}

/**
 * Deserializes a SerializedNode back into a SupplyChainNode.
 * Handles both nested metadata and flat property structures for resilience.
 */
export function deserializeNode(json: any): SupplyChainNode {
    const rawMetadata = json.metadata || {};
    const metadata = {
        productionCapacity: json.productionCapacity ?? rawMetadata.productionCapacity ?? 0,
        capacityUnit: json.capacityUnit ?? rawMetadata.capacityUnit ?? 'tons',
        annualOutput: json.annualOutput ?? rawMetadata.annualOutput,
        owner: json.owner ?? rawMetadata.owner,
        esgStatus: json.esgStatus ?? rawMetadata.esgStatus,
        certifications: json.certifications ?? rawMetadata.certifications ?? [],
        ...rawMetadata,
    };

    return {
        id: json.id,
        type: json.type as SupplyChainNode['type'],
        name: json.name,
        country: json.country as SupplyChainNode['country'],
        coordinates: {
            latitude: json.coordinates?.lat ?? json.coordinates?.latitude ?? 0,
            longitude: json.coordinates?.lng ?? json.coordinates?.longitude ?? 0,
        },
        metadata: metadata as SupplyChainNode['metadata'],
        description: json.description || '',
        createdAt: json.created_at ? new Date(json.created_at) : (json.createdAt ? new Date(json.createdAt) : new Date()),
        updatedAt: json.updated_at ? new Date(json.updated_at) : (json.updatedAt ? new Date(json.updatedAt) : new Date()),
    };
}

/**
 * Serializes a SupplyChainEdge to JSON-compatible format.
 * Converts camelCase to snake_case and Date to ISO 8601 string.
 */
export function serializeEdge(edge: SupplyChainEdge): SerializedEdge {
    return {
        id: edge.id,
        type: edge.type,
        source_node_id: edge.sourceNodeId,
        target_node_id: edge.targetNodeId,
        attributes: { ...edge.attributes } as Record<string, unknown>,
        ...(edge.description ? { description: edge.description } : {}),
        created_at: edge.createdAt.toISOString(),
        updated_at: edge.updatedAt.toISOString(),
    };
}

/**
 * Deserializes a SerializedEdge back into a SupplyChainEdge.
 * Supports both snake_case (source_node_id) and camelCase (sourceNodeId),
 * and handles top-level hsCode.
 */
export function deserializeEdge(json: any): SupplyChainEdge {
    const rawAttributes = json.attributes || {};
    const hsCode = json.hsCode ?? rawAttributes.hsCode ?? '2530.90';
    const logisticsInfo = json.logisticsInfo ?? json.logistics_info ?? rawAttributes.logisticsInfo ?? rawAttributes.logistics_info;
    const attributes = {
        ...rawAttributes,
        hsCode,
        ...(logisticsInfo ? { logisticsInfo } : {}),
    };

    return {
        id: json.id,
        type: json.type as SupplyChainEdge['type'],
        sourceNodeId: json.sourceNodeId ?? json.source_node_id,
        targetNodeId: json.targetNodeId ?? json.target_node_id,
        attributes: attributes as SupplyChainEdge['attributes'],
        description: json.description ?? rawAttributes.description,
        createdAt: json.created_at ? new Date(json.created_at) : (json.createdAt ? new Date(json.createdAt) : new Date()),
        updatedAt: json.updated_at ? new Date(json.updated_at) : (json.updatedAt ? new Date(json.updatedAt) : new Date()),
    };
}
