// ESG 역추적(Traceability) 타입 정의

import type { NodeType } from './graph.js';

/** ESG 준수 상태 */
export type EsgStatus = 'compliant' | 'non_compliant' | 'unverified' | 'unknown';

/** 역추적 경로의 개별 노드 정보 */
export interface TraceabilityNode {
    nodeId: string;
    nodeType: NodeType;
    nodeName: string;
    country: string;
    esgStatus: EsgStatus;
    /** 해당 노드와 관련된 인증 정보 */
    certifications: string[];
}

/** 역추적 경로의 개별 엣지 정보 */
export interface TraceabilityEdge {
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    volume?: number;
    price?: number;
}

/** 단일 업스트림 경로 (Factory → Refinery → Mine) */
export interface UpstreamPath {
    /** 경로 상의 노드들 (Factory부터 Mine까지 순서) */
    nodes: TraceabilityNode[];
    /** 경로 상의 엣지들 (순서대로) */
    edges: TraceabilityEdge[];
    /** 경로에 미검증 노드가 포함되어 있는지 여부 */
    hasUnverifiedSegment: boolean;
}

/** Factory 노드에 대한 전체 역추적 결과 */
export interface TraceabilityResult {
    /** 역추적 대상 Factory 노드 ID */
    factoryNodeId: string;
    /** Factory 이름 */
    factoryName: string;
    /** 발견된 모든 업스트림 경로 */
    upstreamPaths: UpstreamPath[];
    /** 경로가 도달하는 Mine 노드 ID 목록 */
    sourceMinIds: string[];
    /** 중간 Refinery 노드 ID 목록 */
    intermediateRefineryIds: string[];
    /** 미검증 경로 포함 여부 (플래깅 대상) */
    hasUnverifiedPaths: boolean;
    /** 역추적 실행 시간 (ms) */
    computedAt: Date;
}
