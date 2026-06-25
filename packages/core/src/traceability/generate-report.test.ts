import { describe, it, expect } from 'vitest';
import type { TraceabilityResult, UpstreamPath, TraceabilityNode } from '@navigator/shared';
import { generateTraceabilityReport, flagUnverifiedPaths } from './generate-report.js';

// 테스트 헬퍼: TraceabilityNode 생성
function createTraceNode(
    id: string,
    type: 'Resource' | 'Mine' | 'Refinery' | 'Factory',
    options?: {
        name?: string;
        country?: string;
        esgStatus?: 'compliant' | 'non_compliant' | 'unverified' | 'unknown';
        certifications?: string[];
    },
): TraceabilityNode {
    return {
        nodeId: id,
        nodeType: type,
        nodeName: options?.name ?? `${type}-${id}`,
        country: options?.country ?? 'China',
        esgStatus: options?.esgStatus ?? 'compliant',
        certifications: options?.certifications ?? [],
    };
}

// 테스트 헬퍼: UpstreamPath 생성
function createPath(
    nodes: TraceabilityNode[],
    hasUnverifiedSegment: boolean = false,
): UpstreamPath {
    // 엣지는 노드 간 연결을 단순 생성
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
            edgeId: `E-${i}`,
            sourceNodeId: nodes[i + 1].nodeId,
            targetNodeId: nodes[i].nodeId,
            volume: 1000,
            price: 50000,
        });
    }
    return { nodes, edges, hasUnverifiedSegment };
}

// 테스트 헬퍼: TraceabilityResult 생성
function createResult(
    paths: UpstreamPath[],
    options?: {
        factoryNodeId?: string;
        factoryName?: string;
        hasUnverifiedPaths?: boolean;
    },
): TraceabilityResult {
    const sourceMinIds = new Set<string>();
    const intermediateRefineryIds = new Set<string>();

    for (const path of paths) {
        const lastNode = path.nodes[path.nodes.length - 1];
        if (lastNode?.nodeType === 'Mine') {
            sourceMinIds.add(lastNode.nodeId);
        }
        for (const node of path.nodes) {
            if (node.nodeType === 'Refinery') {
                intermediateRefineryIds.add(node.nodeId);
            }
        }
    }

    return {
        factoryNodeId: options?.factoryNodeId ?? 'F-01',
        factoryName: options?.factoryName ?? 'Test Factory',
        upstreamPaths: paths,
        sourceMinIds: Array.from(sourceMinIds),
        intermediateRefineryIds: Array.from(intermediateRefineryIds),
        hasUnverifiedPaths: options?.hasUnverifiedPaths ?? paths.some((p) => p.hasUnverifiedSegment),
        computedAt: new Date('2025-01-01'),
    };
}

describe('flagUnverifiedPaths', () => {
    it('미검증 경로가 없으면 빈 배열을 반환한다', () => {
        const path = createPath([
            createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
            createTraceNode('RF-01', 'Refinery', { esgStatus: 'compliant' }),
            createTraceNode('M-01', 'Mine', { esgStatus: 'compliant' }),
        ]);
        const result = createResult([path]);

        const flagged = flagUnverifiedPaths(result);
        expect(flagged).toHaveLength(0);
    });

    it('unverified 상태 노드가 포함된 경로를 플래깅한다', () => {
        const path = createPath(
            [
                createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
                createTraceNode('RF-01', 'Refinery', { esgStatus: 'unverified' }),
                createTraceNode('M-01', 'Mine', { esgStatus: 'compliant' }),
            ],
            true,
        );
        const result = createResult([path]);

        const flagged = flagUnverifiedPaths(result);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].pathIndex).toBe(0);
        expect(flagged[0].unverifiedNodes).toHaveLength(1);
        expect(flagged[0].unverifiedNodes[0].nodeId).toBe('RF-01');
        expect(flagged[0].reason).toContain('RF-01');
    });

    it('unknown 상태 노드가 포함된 경로를 플래깅한다', () => {
        const path = createPath(
            [
                createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
                createTraceNode('RF-01', 'Refinery', { esgStatus: 'compliant' }),
                createTraceNode('M-01', 'Mine', { esgStatus: 'unknown' }),
            ],
            true,
        );
        const result = createResult([path]);

        const flagged = flagUnverifiedPaths(result);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].unverifiedNodes[0].nodeId).toBe('M-01');
        expect(flagged[0].unverifiedNodes[0].esgStatus).toBe('unknown');
    });

    it('다중 경로에서 미검증 경로만 플래깅한다', () => {
        const cleanPath = createPath([
            createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
            createTraceNode('RF-01', 'Refinery', { esgStatus: 'compliant' }),
            createTraceNode('M-01', 'Mine', { esgStatus: 'compliant' }),
        ]);
        const unverifiedPath = createPath(
            [
                createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
                createTraceNode('RF-02', 'Refinery', { esgStatus: 'unverified' }),
                createTraceNode('M-02', 'Mine', { esgStatus: 'unknown' }),
            ],
            true,
        );
        const result = createResult([cleanPath, unverifiedPath]);

        const flagged = flagUnverifiedPaths(result);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].pathIndex).toBe(1);
        expect(flagged[0].unverifiedNodes).toHaveLength(2);
    });

    it('하나의 경로에 여러 미검증 노드가 있으면 모두 포함한다', () => {
        const path = createPath(
            [
                createTraceNode('F-01', 'Factory', { esgStatus: 'unknown' }),
                createTraceNode('RF-01', 'Refinery', { esgStatus: 'unverified' }),
                createTraceNode('M-01', 'Mine', { esgStatus: 'unverified' }),
            ],
            true,
        );
        const result = createResult([path]);

        const flagged = flagUnverifiedPaths(result);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].unverifiedNodes).toHaveLength(3);
    });

    it('빈 경로 목록이면 빈 배열을 반환한다', () => {
        const result = createResult([]);
        const flagged = flagUnverifiedPaths(result);
        expect(flagged).toHaveLength(0);
    });
});

describe('generateTraceabilityReport', () => {
    describe('소스 출처(sourceOrigins) 추출', () => {
        it('모든 Mine 노드를 원산지로 추출한다', () => {
            const path1 = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('RF-01', 'Refinery'),
                createTraceNode('M-01', 'Mine', {
                    name: 'Salar de Atacama',
                    country: 'Chile',
                    certifications: ['IRMA'],
                }),
            ]);
            const path2 = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('RF-02', 'Refinery'),
                createTraceNode('M-02', 'Mine', {
                    name: 'Greenbushes',
                    country: 'UnitedStates',
                    certifications: ['ISO 14001'],
                }),
            ]);
            const result = createResult([path1, path2]);

            const report = generateTraceabilityReport(result);

            expect(report.sourceOrigins).toHaveLength(2);
            expect(report.sourceOrigins[0].mineNodeId).toBe('M-01');
            expect(report.sourceOrigins[0].mineName).toBe('Salar de Atacama');
            expect(report.sourceOrigins[0].country).toBe('Chile');
            expect(report.sourceOrigins[0].certifications).toEqual(['IRMA']);
            expect(report.sourceOrigins[1].mineNodeId).toBe('M-02');
        });

        it('동일 Mine이 여러 경로에 등장해도 중복 제거한다', () => {
            const path1 = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('RF-01', 'Refinery'),
                createTraceNode('M-01', 'Mine', { name: 'Mine A' }),
            ]);
            const path2 = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('RF-02', 'Refinery'),
                createTraceNode('M-01', 'Mine', { name: 'Mine A' }),
            ]);
            const result = createResult([path1, path2]);

            const report = generateTraceabilityReport(result);

            expect(report.sourceOrigins).toHaveLength(1);
            expect(report.sourceOrigins[0].mineNodeId).toBe('M-01');
        });
    });

    describe('처리 단계(processingStages) 추출', () => {
        it('Factory와 Refinery를 처리 단계로 추출한다 (Mine 제외)', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory', {
                    name: 'Samsung SDI',
                    country: 'SouthKorea',
                    certifications: ['ISO 9001'],
                }),
                createTraceNode('RF-01', 'Refinery', {
                    name: 'Ganfeng Xinyu',
                    country: 'China',
                    certifications: ['ISO 14001'],
                }),
                createTraceNode('M-01', 'Mine', { name: 'Salar Mine' }),
            ]);
            const result = createResult([path]);

            const report = generateTraceabilityReport(result);

            expect(report.processingStages).toHaveLength(2);
            // stageOrder 순서: Factory(0) → Refinery(1)
            expect(report.processingStages[0].nodeId).toBe('F-01');
            expect(report.processingStages[0].nodeType).toBe('Factory');
            expect(report.processingStages[0].stageOrder).toBe(0);
            expect(report.processingStages[1].nodeId).toBe('RF-01');
            expect(report.processingStages[1].nodeType).toBe('Refinery');
            expect(report.processingStages[1].stageOrder).toBe(1);
        });

        it('여러 경로에서 중복 노드를 제거하여 처리 단계를 추출한다', () => {
            const path1 = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('RF-01', 'Refinery'),
                createTraceNode('M-01', 'Mine'),
            ]);
            const path2 = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('RF-01', 'Refinery'),
                createTraceNode('M-02', 'Mine'),
            ]);
            const result = createResult([path1, path2]);

            const report = generateTraceabilityReport(result);

            // Factory 1개 + Refinery 1개 = 2개 (중복 제거)
            expect(report.processingStages).toHaveLength(2);
        });
    });

    describe('인증 정보(allCertifications) 수집', () => {
        it('모든 노드의 인증 정보를 중복 제거하여 수집한다', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory', { certifications: ['ISO 9001', 'IATF 16949'] }),
                createTraceNode('RF-01', 'Refinery', { certifications: ['ISO 14001', 'ISO 9001'] }),
                createTraceNode('M-01', 'Mine', { certifications: ['IRMA', 'ISO 14001'] }),
            ]);
            const result = createResult([path]);

            const report = generateTraceabilityReport(result);

            // 중복 제거: ISO 9001, IATF 16949, ISO 14001, IRMA
            expect(report.allCertifications).toHaveLength(4);
            expect(report.allCertifications).toContain('ISO 9001');
            expect(report.allCertifications).toContain('ISO 14001');
            expect(report.allCertifications).toContain('IRMA');
            expect(report.allCertifications).toContain('IATF 16949');
        });

        it('인증 정보가 없는 경우 빈 배열을 반환한다', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('M-01', 'Mine'),
            ]);
            const result = createResult([path]);

            const report = generateTraceabilityReport(result);
            expect(report.allCertifications).toHaveLength(0);
        });

        it('인증 정보를 알파벳 순으로 정렬한다', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory', { certifications: ['ZZZ', 'AAA'] }),
                createTraceNode('M-01', 'Mine', { certifications: ['MMM'] }),
            ]);
            const result = createResult([path]);

            const report = generateTraceabilityReport(result);
            expect(report.allCertifications).toEqual(['AAA', 'MMM', 'ZZZ']);
        });
    });

    describe('플래깅(flaggedPaths) 통합', () => {
        it('미검증 경로가 보고서에 포함된다', () => {
            const path = createPath(
                [
                    createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
                    createTraceNode('RF-01', 'Refinery', { esgStatus: 'unverified' }),
                    createTraceNode('M-01', 'Mine', { esgStatus: 'compliant' }),
                ],
                true,
            );
            const result = createResult([path]);

            const report = generateTraceabilityReport(result);

            expect(report.flaggedPaths).toHaveLength(1);
            expect(report.hasUnverifiedPaths).toBe(true);
        });

        it('모든 경로가 compliant이면 플래깅 없음', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory', { esgStatus: 'compliant' }),
                createTraceNode('RF-01', 'Refinery', { esgStatus: 'compliant' }),
                createTraceNode('M-01', 'Mine', { esgStatus: 'compliant' }),
            ]);
            const result = createResult([path]);

            const report = generateTraceabilityReport(result);

            expect(report.flaggedPaths).toHaveLength(0);
            expect(report.hasUnverifiedPaths).toBe(false);
        });
    });

    describe('보고서 메타데이터', () => {
        it('Factory 정보가 보고서에 포함된다', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('M-01', 'Mine'),
            ]);
            const result = createResult([path], {
                factoryNodeId: 'F-01',
                factoryName: 'Samsung SDI Cheonan',
            });

            const report = generateTraceabilityReport(result);

            expect(report.factoryNodeId).toBe('F-01');
            expect(report.factoryName).toBe('Samsung SDI Cheonan');
        });

        it('generatedAt 필드가 현재 시간으로 설정된다', () => {
            const path = createPath([
                createTraceNode('F-01', 'Factory'),
                createTraceNode('M-01', 'Mine'),
            ]);
            const result = createResult([path]);

            const before = new Date();
            const report = generateTraceabilityReport(result);
            const after = new Date();

            expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(report.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('빈 결과 처리', () => {
        it('업스트림 경로가 없는 결과로 보고서를 생성할 수 있다', () => {
            const result = createResult([], {
                factoryNodeId: 'F-01',
                factoryName: 'Empty Factory',
            });

            const report = generateTraceabilityReport(result);

            expect(report.factoryNodeId).toBe('F-01');
            expect(report.factoryName).toBe('Empty Factory');
            expect(report.sourceOrigins).toHaveLength(0);
            expect(report.processingStages).toHaveLength(0);
            expect(report.allCertifications).toHaveLength(0);
            expect(report.flaggedPaths).toHaveLength(0);
            expect(report.hasUnverifiedPaths).toBe(false);
        });
    });
});
