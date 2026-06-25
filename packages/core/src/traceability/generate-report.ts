// 역추적 보고서 생성 및 미검증 경로 플래깅 로직

import type {
    TraceabilityResult,
    TraceabilityReport,
    SourceOrigin,
    ProcessingStage,
    FlaggedPath,
    TraceabilityNode,
    UpstreamPath,
} from '@navigator/shared';

/**
 * 역추적 결과에서 미검증(unverified/unknown) ESG 상태 노드를 포함하는
 * 경로를 식별하고 플래깅된 경로 목록을 반환한다.
 *
 * @param result - computeUpstreamPaths로 계산된 역추적 결과
 * @returns 미검증 노드를 포함하는 플래깅된 경로 목록
 */
export function flagUnverifiedPaths(result: TraceabilityResult): FlaggedPath[] {
    const flaggedPaths: FlaggedPath[] = [];

    for (let i = 0; i < result.upstreamPaths.length; i++) {
        const path = result.upstreamPaths[i];

        if (!path.hasUnverifiedSegment) {
            continue;
        }

        // 경로 내 미검증 노드 수집
        const unverifiedNodes = path.nodes.filter(
            (node) => node.esgStatus === 'unverified' || node.esgStatus === 'unknown',
        );

        if (unverifiedNodes.length > 0) {
            const nodeNames = unverifiedNodes.map((n) => n.nodeName).join(', ');
            flaggedPaths.push({
                pathIndex: i,
                unverifiedNodes,
                reason: `경로에 ESG 미검증 노드 포함: ${nodeNames}`,
            });
        }
    }

    return flaggedPaths;
}

/**
 * 업스트림 경로들에서 원산지(Mine) 정보를 추출한다.
 * 동일한 Mine이 여러 경로에 등장해도 중복 제거하여 반환한다.
 */
function extractSourceOrigins(upstreamPaths: UpstreamPath[]): SourceOrigin[] {
    const originMap = new Map<string, SourceOrigin>();

    for (const path of upstreamPaths) {
        // 경로의 마지막 노드가 Mine (Factory → ... → Mine 순서)
        const mineNode = path.nodes[path.nodes.length - 1];
        if (mineNode && mineNode.nodeType === 'Mine' && !originMap.has(mineNode.nodeId)) {
            originMap.set(mineNode.nodeId, {
                mineNodeId: mineNode.nodeId,
                mineName: mineNode.nodeName,
                country: mineNode.country,
                esgStatus: mineNode.esgStatus,
                certifications: [...mineNode.certifications],
            });
        }
    }

    return Array.from(originMap.values());
}

/**
 * 업스트림 경로들에서 처리 단계(Refinery, Factory 등) 정보를 추출한다.
 * Mine을 제외한 모든 중간 노드를 처리 단계로 취급한다.
 * 동일 노드가 여러 경로에 등장해도 중복 제거하여 반환한다.
 */
function extractProcessingStages(upstreamPaths: UpstreamPath[]): ProcessingStage[] {
    const stageMap = new Map<string, ProcessingStage>();

    for (const path of upstreamPaths) {
        // Mine을 제외한 나머지 노드가 처리 단계
        // 경로 순서: Factory(0) → Refinery(1..n-1) → Mine(n)
        for (let i = 0; i < path.nodes.length; i++) {
            const node = path.nodes[i];
            // Mine은 소스 원산지이므로 처리 단계에서 제외
            if (node.nodeType === 'Mine') {
                continue;
            }

            if (!stageMap.has(node.nodeId)) {
                stageMap.set(node.nodeId, {
                    nodeId: node.nodeId,
                    nodeName: node.nodeName,
                    nodeType: node.nodeType,
                    country: node.country,
                    esgStatus: node.esgStatus,
                    certifications: [...node.certifications],
                    stageOrder: i,
                });
            }
        }
    }

    // stageOrder 기준 내림차순 정렬 (다운스트림 Factory가 먼저)
    return Array.from(stageMap.values()).sort((a, b) => a.stageOrder - b.stageOrder);
}

/**
 * 모든 경로의 노드에서 인증 정보를 수집하고 중복을 제거한다.
 */
function collectAllCertifications(upstreamPaths: UpstreamPath[]): string[] {
    const certSet = new Set<string>();

    for (const path of upstreamPaths) {
        for (const node of path.nodes) {
            for (const cert of node.certifications) {
                certSet.add(cert);
            }
        }
    }

    return Array.from(certSet).sort();
}

/**
 * 역추적 결과를 기반으로 소스 출처, 처리 단계, 인증 정보 및
 * 미검증 경로 플래깅을 포함하는 종합 보고서를 생성한다.
 *
 * @param result - computeUpstreamPaths로 계산된 역추적 결과
 * @returns 종합 역추적 보고서
 */
export function generateTraceabilityReport(
    result: TraceabilityResult,
): TraceabilityReport {
    const sourceOrigins = extractSourceOrigins(result.upstreamPaths);
    const processingStages = extractProcessingStages(result.upstreamPaths);
    const allCertifications = collectAllCertifications(result.upstreamPaths);
    const flaggedPaths = flagUnverifiedPaths(result);

    return {
        factoryNodeId: result.factoryNodeId,
        factoryName: result.factoryName,
        sourceOrigins,
        processingStages,
        allCertifications,
        flaggedPaths,
        hasUnverifiedPaths: result.hasUnverifiedPaths,
        generatedAt: new Date(),
    };
}
