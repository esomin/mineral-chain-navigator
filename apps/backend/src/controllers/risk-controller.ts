// 리스크 분석 컨트롤러
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RiskScore, Country } from '@navigator/shared';
import {
    computeNodeHHI,
    computeNodeRisk,
    computeSRILNodeRisk,
    computeEdgeRisk,
    flagHighRisk,
    type SRILNodeFactors,
} from '@navigator/core';
import type { DataStore } from '@navigator/database';

/** 기본 WGI 점수 매핑 (높을수록 안정적, 0-100) */
const DEFAULT_WGI_SCORES: Map<Country, number> = new Map([
    ['SouthKorea', 75],
    ['Japan', 80],
    ['China', 45],
    ['Chile', 65],
    ['UnitedStates', 78],
    ['NA', 50],
]);

/** 고위험 임계값 */
const HIGH_RISK_THRESHOLD = 60;

interface SRILScoreItem extends SRILNodeFactors {
    nodeId: string;
}

/** sril-scores.json 파일 로드 */
function loadSRILScores(): Map<string, SRILScoreItem> {
    const map = new Map<string, SRILScoreItem>();
    try {
        const currentDir = dirname(fileURLToPath(import.meta.url));
        // apps/backend/src/controllers/ -> packages/pipeline/data/risk-factors/ (4 levels up)
        let srilPath = resolve(currentDir, '..', '..', '..', '..', 'packages', 'pipeline', 'data', 'risk-factors', 'sril-scores.json');
        if (!existsSync(srilPath)) {
            // cwd 기반 fallback (apps/backend에서 실행 시)
            srilPath = resolve(process.cwd(), '..', '..', 'packages', 'pipeline', 'data', 'risk-factors', 'sril-scores.json');
        }

        if (existsSync(srilPath)) {
            const raw = readFileSync(srilPath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.nodes)) {
                for (const item of parsed.nodes) {
                    const id = item.nodeId || item.id;
                    if (id) {
                        map.set(id, item);
                    }
                }
                console.log(`[RiskController] Successfully loaded ${map.size} SRIL scores from ${srilPath}`);
            }
        } else {
            console.warn('[RiskController] sril-scores.json file not found at:', srilPath);
        }
    } catch (e) {
        console.warn('[RiskController] Failed to load sril-scores.json:', e);
    }
    return map;
}

/**
 * 리스크 계산 컨트롤러.
 * @navigator/core의 비즈니스 로직과 @navigator/database의 데이터를 조합하여
 * 리스크 점수를 계산한다.
 */
export class RiskController {
    private readonly srilScoresMap = loadSRILScores();

    constructor(private readonly store: DataStore) { }

    /**
     * 특정 노드의 리스크 점수를 계산하여 반환한다.
     * @param nodeId 노드 ID
     * @returns 계산된 RiskScore 또는 null (노드 미존재 시)
     */
    getNodeRisk(nodeId: string): RiskScore | null {
        const node = this.store.getNodeById(nodeId);
        if (!node) return null;

        const srilData = this.srilScoresMap.get(nodeId);
        if (srilData) {
            const riskScore = computeSRILNodeRisk(node, srilData);
            const [flagged] = flagHighRisk([riskScore], HIGH_RISK_THRESHOLD);
            return flagged;
        }

        const inboundEdges = this.store.getInboundEdges(nodeId);
        const hhi = computeNodeHHI(nodeId, inboundEdges);
        const wgi = DEFAULT_WGI_SCORES.get(node.country) ?? 50;

        const riskScore = computeNodeRisk(node, { hhi, wgi });
        const [flagged] = flagHighRisk([riskScore], HIGH_RISK_THRESHOLD);
        return flagged;
    }

    /**
     * 특정 엣지의 리스크 점수를 계산하여 반환한다.
     * @param edgeId 엣지 ID
     * @returns 계산된 RiskScore 또는 null (엣지 미존재 시)
     */
    getEdgeRisk(edgeId: string): RiskScore | null {
        const edge = this.store.getEdgeById(edgeId);
        if (!edge) return null;

        const allEdges = this.store.getEdges();
        const tradeDependency = this.computeTradeDependency(edge, allEdges);
        const regulatoryRisk = this.computeRegulatoryRisk(edge);

        const riskScore = computeEdgeRisk(edge, { tradeDependency, regulatoryRisk });
        const [flagged] = flagHighRisk([riskScore], HIGH_RISK_THRESHOLD);
        return flagged;
    }

    /**
     * 모든 노드와 엣지의 리스크 점수를 재계산한다.
     * @returns 전체 재계산된 RiskScore 배열
     */
    recalculateAll(): RiskScore[] {
        const nodes = this.store.getNodes();
        const allEdges = this.store.getEdges();
        const results: RiskScore[] = [];

        // 모든 노드 리스크 재계산 (SRIL 점수 우선 사용)
        for (const node of nodes) {
            const srilData = this.srilScoresMap.get(node.id);
            if (srilData) {
                results.push(computeSRILNodeRisk(node, srilData));
            } else {
                const inboundEdges = this.store.getInboundEdges(node.id);
                const hhi = computeNodeHHI(node.id, inboundEdges);
                const wgi = DEFAULT_WGI_SCORES.get(node.country) ?? 50;
                results.push(computeNodeRisk(node, { hhi, wgi }));
            }
        }

        // 모든 엣지 리스크 재계산
        for (const edge of allEdges) {
            const tradeDependency = this.computeTradeDependency(edge, allEdges);
            const regulatoryRisk = this.computeRegulatoryRisk(edge);
            results.push(computeEdgeRisk(edge, { tradeDependency, regulatoryRisk }));
        }

        return flagHighRisk(results, HIGH_RISK_THRESHOLD);
    }

    /** 엣지의 무역 의존도 계산 (0-1) */
    private computeTradeDependency(
        edge: { targetNodeId: string; attributes: { volume?: number } },
        allEdges: { targetNodeId: string; attributes: { volume?: number } }[],
    ): number {
        const edgeVolume = edge.attributes.volume ?? 0;
        if (edgeVolume === 0) return 0;

        const totalInboundVolume = allEdges
            .filter((e) => e.targetNodeId === edge.targetNodeId && (e.attributes.volume ?? 0) > 0)
            .reduce((sum, e) => sum + (e.attributes.volume ?? 0), 0);

        if (totalInboundVolume === 0) return 0;
        return edgeVolume / totalInboundVolume;
    }

    /** 엣지의 규제 리스크 계산 */
    private computeRegulatoryRisk(edge: { attributes: { iraCompliant?: boolean } }): number {
        const { iraCompliant } = edge.attributes;
        if (iraCompliant === false) return 80;
        if (iraCompliant === true) return 10;
        return 40;
    }
}
