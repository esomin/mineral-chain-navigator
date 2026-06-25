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

// --- 역추적 보고서 관련 타입    

/** 공급망 원산지 정보 (광산 소스) */
export interface SourceOrigin {
    /** 광산 노드 ID */
    mineNodeId: string;
    /** 광산 이름 */
    mineName: string;
    /** 광산 소재 국가 */
    country: string;
    /** ESG 준수 상태 */
    esgStatus: EsgStatus;
    /** 보유 인증 목록 */
    certifications: string[];
}

/** 공급망 처리 단계 정보 */
export interface ProcessingStage {
    /** 처리 단계 노드 ID */
    nodeId: string;
    /** 처리 시설 이름 */
    nodeName: string;
    /** 노드 유형 (Refinery, Factory 등) */
    nodeType: NodeType;
    /** 시설 소재 국가 */
    country: string;
    /** ESG 준수 상태 */
    esgStatus: EsgStatus;
    /** 보유 인증 목록 */
    certifications: string[];
    /** 처리 단계 순서 (0-based, 업스트림 → 다운스트림) */
    stageOrder: number;
}

/** 미검증 ESG 상태를 포함하는 플래깅된 경로 정보 */
export interface FlaggedPath {
    /** 플래깅 대상 경로 인덱스 (upstreamPaths 내 위치) */
    pathIndex: number;
    /** 경로 내 미검증 노드 목록 */
    unverifiedNodes: TraceabilityNode[];
    /** 플래깅 사유 설명 */
    reason: string;
}

/** 역추적 보고서 (소스 출처, 처리 단계, 인증 정보, 플래깅 정보 포함) */
export interface TraceabilityReport {
    /** 역추적 대상 Factory 노드 ID */
    factoryNodeId: string;
    /** Factory 이름 */
    factoryName: string;
    /** 원산지(광산) 목록 */
    sourceOrigins: SourceOrigin[];
    /** 처리 단계 목록 (모든 경로에서 중복 제거) */
    processingStages: ProcessingStage[];
    /** 전체 인증 정보 목록 (중복 제거) */
    allCertifications: string[];
    /** ESG 미검증 경로 플래깅 결과 */
    flaggedPaths: FlaggedPath[];
    /** 미검증 경로 포함 여부 */
    hasUnverifiedPaths: boolean;
    /** 보고서 생성 시간 */
    generatedAt: Date;
}
