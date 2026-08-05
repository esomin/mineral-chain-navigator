import { describe, it, expect } from 'vitest';
import type { SupplyChainNode, SupplyChainEdge, SimulationResult } from '@navigator/shared';
import { computeReroutingOptions } from './rerouting-engine.js';

describe('computeReroutingOptions', () => {
    const mockNodes: SupplyChainNode[] = [
        {
            id: 'MINE_AU_PILBARA',
            type: 'Mine',
            name: 'Pilgangoora',
            country: 'Australia',
            coordinates: { latitude: -21.0, longitude: 118.0 },
            metadata: { productionCapacity: 755000, capacityUnit: 'tons' },
            description: 'Mine',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: 'MINE_CL_SQM',
            type: 'Mine',
            name: 'SQM Atacama',
            country: 'Chile',
            coordinates: { latitude: -23.0, longitude: -68.0 },
            metadata: { productionCapacity: 210000, capacityUnit: 'tons' },
            description: 'Mine Chile',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: 'REF_KR_POSCO_PILBARA',
            type: 'Refinery',
            name: 'POSCO Pilbara',
            country: 'SouthKorea',
            coordinates: { latitude: 34.9, longitude: 127.7 },
            metadata: { productionCapacity: 43000, capacityUnit: 'tons' },
            description: 'Refinery KR',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: 'MAT_KR_POSCO_FUTUREM',
            type: 'Factory',
            name: 'POSCO FutureM',
            country: 'SouthKorea',
            coordinates: { latitude: 36.0, longitude: 129.3 },
            metadata: { productionCapacity: 60000, capacityUnit: 'tons' },
            description: 'Factory KR',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];

    const mockEdges: SupplyChainEdge[] = [
        {
            id: 'E-MINE_AU_PILBARA-REF_KR_POSCO_PILBARA',
            type: 'Supply',
            sourceNodeId: 'MINE_AU_PILBARA',
            targetNodeId: 'REF_KR_POSCO_PILBARA',
            attributes: {
                hsCode: '2530.90',
                logisticsInfo: {
                    transportMode: 'Maritime',
                    distanceKm: 5400,
                    leadTimeDays: 11.2,
                    customsDelayDays: 2.0,
                    totalLeadTimeDays: 13.2,
                    freightCostUsdPerTon: 85.0,
                },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: 'E-REF_KR_POSCO_PILBARA-MAT_KR_POSCO_FUTUREM',
            type: 'Delivery',
            sourceNodeId: 'REF_KR_POSCO_PILBARA',
            targetNodeId: 'MAT_KR_POSCO_FUTUREM',
            attributes: {
                hsCode: '2825.20',
                logisticsInfo: {
                    transportMode: 'Road',
                    distanceKm: 120,
                    leadTimeDays: 0.4,
                    customsDelayDays: 0,
                    totalLeadTimeDays: 0.4,
                    freightCostUsdPerTon: 25.0,
                },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];

    it('should return empty array if no node has supply deficit', () => {
        const result: SimulationResult = {
            scenarioId: 'SCENARIO-01',
            propagationPaths: [],
            deficits: [
                { nodeId: 'MAT_KR_POSCO_FUTUREM', originalSupply: 100, disruptedSupply: 100, deficitPercentage: 0 },
            ],
            executionTimeMs: 12,
        };

        const reroutes = computeReroutingOptions(result, mockNodes, mockEdges, 'balanced');
        expect(reroutes).toEqual([]);
    });

    it('should calculate rerouting options for node with 50% supply deficit', () => {
        const result: SimulationResult = {
            scenarioId: 'SCENARIO-50-PERCENT-DEFICIT',
            propagationPaths: [],
            deficits: [
                { nodeId: 'MAT_KR_POSCO_FUTUREM', originalSupply: 100, disruptedSupply: 50, deficitPercentage: 50.0 },
            ],
            executionTimeMs: 15,
        };

        const reroutes = computeReroutingOptions(result, mockNodes, mockEdges, 'balanced');

        expect(reroutes).toHaveLength(1);
        expect(reroutes[0].targetNodeId).toBe('MAT_KR_POSCO_FUTUREM');
        expect(reroutes[0].originalDeficitPercentage).toBe(50.0);
        expect(reroutes[0].remainingDeficitPercentage).toBe(0);
        expect(reroutes[0].options.length).toBeGreaterThan(0);
        expect(reroutes[0].options[0].rank).toBe(1);
    });
});
